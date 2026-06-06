#!/usr/bin/env python3
"""
Project Aether — skeleton post-processing batch job.

Runs once after a recording session and processes every clip in the Supabase
`clips` table that has not yet been processed:

  1. Download the raw video from Supabase Storage.
  2. Run YOLO11 Pose estimation on every frame (ultralytics).
  3. Draw a semi-transparent, color-coded skeleton overlay
       - left-side joints/bones  : blue
       - right-side joints/bones : green
       - center (nose/torso)     : white
  4. Re-encode at the original framerate.
  5. Upload to skateboard-data/{trick-name}/processed/{filename}_skeleton.mp4
  6. Mark the clip row `processed = true`.

Usage:
    cd scripts
    pip install -r requirements.txt
    python process_skeletons.py

Credentials are read from a `.env` file (or the environment):
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   (or SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY)
"""

from __future__ import annotations

import os
import sys
import time
import tempfile
import traceback
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BUCKET = "skateboard-data"
MODEL_NAME = os.environ.get("AETHER_POSE_MODEL", "yolo11n-pose.pt")
OVERLAY_ALPHA = 0.6  # opacity of the skeleton overlay (0..1)

# COCO-17 keypoint layout used by YOLO pose models.
KP_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

# Skeleton bone connections (pairs of keypoint indices).
SKELETON = [
    (5, 7), (7, 9),        # left arm
    (6, 8), (8, 10),       # right arm
    (11, 13), (13, 15),    # left leg
    (12, 14), (14, 16),    # right leg
    (5, 6), (11, 12),      # shoulders / hips
    (5, 11), (6, 12),      # torso sides
    (0, 5), (0, 6),        # nose -> shoulders
    (1, 2), (0, 1), (0, 2),  # face
    (1, 3), (2, 4),        # eyes -> ears
]

# BGR colors (OpenCV order).
COLOR_LEFT = (255, 128, 0)    # blue
COLOR_RIGHT = (0, 200, 0)     # green
COLOR_CENTER = (255, 255, 255)  # white

LEFT_IDX = {1, 3, 5, 7, 9, 11, 13, 15}
RIGHT_IDX = {2, 4, 6, 8, 10, 12, 14, 16}


def side_color(idx: int) -> tuple[int, int, int]:
    """Color for a single keypoint based on body side."""
    if idx in LEFT_IDX:
        return COLOR_LEFT
    if idx in RIGHT_IDX:
        return COLOR_RIGHT
    return COLOR_CENTER


def bone_color(a: int, b: int) -> tuple[int, int, int]:
    """Color for a bone connecting two keypoints."""
    if a in LEFT_IDX and b in LEFT_IDX:
        return COLOR_LEFT
    if a in RIGHT_IDX and b in RIGHT_IDX:
        return COLOR_RIGHT
    return COLOR_CENTER


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def get_supabase() -> Client:
    load_dotenv()
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    )
    if not url or not key:
        print(
            "ERROR: Supabase credentials not found. Set NEXT_PUBLIC_SUPABASE_URL "
            "and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) "
            "in a .env file or the environment.",
            file=sys.stderr,
        )
        sys.exit(1)
    return create_client(url, key)


def object_path_in_bucket(storage_path: str) -> str:
    """
    Convert a stored `storage_path` into a path relative to the bucket.

    storage_path is recorded as e.g. "skateboard-data/kickflip/clip.webm";
    storage operations want "kickflip/clip.webm".
    """
    prefix = f"{BUCKET}/"
    if storage_path.startswith(prefix):
        return storage_path[len(prefix):]
    return storage_path.lstrip("/")


# ---------------------------------------------------------------------------
# Frame drawing
# ---------------------------------------------------------------------------

def draw_skeleton(frame: np.ndarray, keypoints_xy, confs) -> np.ndarray:
    """
    Draw a semi-transparent, color-coded skeleton overlay onto `frame`.

    keypoints_xy: array (N_people, 17, 2)
    confs:        array (N_people, 17) confidence per keypoint
    """
    overlay = frame.copy()
    h, w = frame.shape[:2]
    radius = max(2, int(round(min(h, w) / 180)))
    thickness = max(2, int(round(min(h, w) / 220)))
    conf_thresh = 0.3

    for person_xy, person_conf in zip(keypoints_xy, confs):
        # Bones first so joints render on top.
        for a, b in SKELETON:
            if person_conf[a] < conf_thresh or person_conf[b] < conf_thresh:
                continue
            ax, ay = person_xy[a]
            bx, by = person_xy[b]
            cv2.line(
                overlay,
                (int(ax), int(ay)),
                (int(bx), int(by)),
                bone_color(a, b),
                thickness,
                lineType=cv2.LINE_AA,
            )
        # Joints
        for idx, ((x, y), c) in enumerate(zip(person_xy, person_conf)):
            if c < conf_thresh:
                continue
            cv2.circle(
                overlay,
                (int(x), int(y)),
                radius,
                side_color(idx),
                -1,
                lineType=cv2.LINE_AA,
            )

    # Blend so the original video stays visible underneath.
    return cv2.addWeighted(overlay, OVERLAY_ALPHA, frame, 1 - OVERLAY_ALPHA, 0)


# ---------------------------------------------------------------------------
# Per-clip processing
# ---------------------------------------------------------------------------

def process_clip(supabase: Client, model, clip: dict, tmpdir: Path) -> bool:
    """Process a single clip row. Returns True on success."""
    clip_id = clip["id"]
    filename = clip["filename"]
    trick = clip.get("trick_name", "unknown")
    storage_path = clip["storage_path"]
    obj_path = object_path_in_bucket(storage_path)

    print(f"\n=== Processing clip: {filename} (trick: {trick}) ===")
    t0 = time.time()

    # --- Download raw video -------------------------------------------------
    local_in = tmpdir / filename
    print(f"  Downloading {BUCKET}/{obj_path} ...")
    data = supabase.storage.from_(BUCKET).download(obj_path)
    local_in.write_bytes(data)

    cap = cv2.VideoCapture(str(local_in))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open downloaded video: {local_in}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    stem = Path(filename).stem
    out_name = f"{stem}_skeleton.mp4"
    local_out = tmpdir / out_name
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(local_out), fourcc, fps, (width, height))

    frame_count = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_count += 1

        # YOLO11 pose inference on this frame.
        results = model.predict(frame, verbose=False)
        result = results[0]

        if result.keypoints is not None and result.keypoints.xy is not None:
            kp_xy = result.keypoints.xy.cpu().numpy()  # (people, 17, 2)
            if result.keypoints.conf is not None:
                kp_conf = result.keypoints.conf.cpu().numpy()  # (people, 17)
            else:
                kp_conf = np.ones(kp_xy.shape[:2], dtype=np.float32)
            if kp_xy.shape[0] > 0:
                frame = draw_skeleton(frame, kp_xy, kp_conf)

        writer.write(frame)

    cap.release()
    writer.release()

    elapsed = time.time() - t0
    print(
        f"  Frames: {frame_count} | {fps:.1f} fps | "
        f"processing time: {elapsed:.1f}s"
    )

    # --- Upload processed video --------------------------------------------
    folder = os.path.dirname(obj_path)  # e.g. "kickflip"
    processed_path = f"{folder}/processed/{out_name}" if folder else f"processed/{out_name}"
    print(f"  Uploading -> {BUCKET}/{processed_path}")
    with open(local_out, "rb") as f:
        supabase.storage.from_(BUCKET).upload(
            processed_path,
            f.read(),
            {"content-type": "video/mp4", "upsert": "true"},
        )

    # --- Mark processed -----------------------------------------------------
    supabase.table("clips").update({"processed": True}).eq("id", clip_id).execute()
    print(f"  ✓ Done in {elapsed:.1f}s")
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    supabase = get_supabase()

    print("Loading YOLO11 pose model:", MODEL_NAME)
    # Imported lazily so the script can at least print a helpful error if the
    # ultralytics install is missing.
    from ultralytics import YOLO

    model = YOLO(MODEL_NAME)

    print("Querying unprocessed clips ...")
    resp = (
        supabase.table("clips")
        .select("*")
        .eq("processed", False)
        .order("recorded_at", desc=False)
        .execute()
    )
    clips = resp.data or []
    print(f"Found {len(clips)} unprocessed clip(s).")

    if not clips:
        return 0

    succeeded = 0
    failed = 0

    with tempfile.TemporaryDirectory(prefix="aether_") as tmp:
        tmpdir = Path(tmp)
        for clip in clips:
            try:
                if process_clip(supabase, model, clip, tmpdir):
                    succeeded += 1
            except Exception as exc:  # noqa: BLE001 — keep going on any failure
                failed += 1
                print(
                    f"  ✗ FAILED to process {clip.get('filename', clip.get('id'))}: {exc}",
                    file=sys.stderr,
                )
                traceback.print_exc()
                continue

    print(f"\nBatch complete: {succeeded} processed, {failed} failed.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
