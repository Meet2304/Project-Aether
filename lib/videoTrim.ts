"use client";

/**
 * Client-side clip trimming.
 *
 * Strategy (per the requirements):
 *  1. Prefer trimming the segment client-side. We do this by seeking a hidden
 *     <video> to the IN point, drawing frames to a <canvas>, capturing the
 *     canvas stream and re-recording the segment with MediaRecorder. This is
 *     well supported across modern mobile Chrome/Safari/Firefox.
 *  2. If the required APIs are missing, we fall back to returning the full
 *     video, and the caller encodes the IN/OUT points into the filename so the
 *     Python post-processor can trim it later.
 *
 * WebCodecs (`VideoEncoder`/`VideoDecoder`) is detected and reported, but the
 * canvas re-record path is used as the primary trimmer because it produces a
 * playable container without manual muxing.
 */

export interface TrimResult {
  blob: Blob;
  /** File extension for the produced blob (without leading dot). */
  ext: "webm" | "mp4";
  /** True when the segment was actually trimmed; false on metadata fallback. */
  trimmed: boolean;
  /** The MediaRecorder mimeType used (or the source type on fallback). */
  mimeType: string;
}

/** Whether the browser exposes the WebCodecs encoding API. */
export function hasWebCodecs(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window;
}

/** Whether we can re-record a canvas stream (the primary trim path). */
export function canCanvasTrim(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

/** Picks the best supported recording mimeType, preferring webm. */
function pickMimeType(): { mimeType: string; ext: "webm" | "mp4" } {
  const candidates: Array<{ mimeType: string; ext: "webm" | "mp4" }> = [
    { mimeType: "video/webm;codecs=vp9", ext: "webm" },
    { mimeType: "video/webm;codecs=vp8", ext: "webm" },
    { mimeType: "video/webm", ext: "webm" },
    { mimeType: "video/mp4", ext: "mp4" },
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c.mimeType)
    ) {
      return c;
    }
  }
  return { mimeType: "video/webm", ext: "webm" };
}

/** Loads a video element from a blob URL and waits for metadata. */
function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    const onReady = () => {
      // Some browsers report 0 duration until further buffering; guard for it.
      if (video.readyState >= 1) resolve(video);
    };
    video.onloadedmetadata = onReady;
    video.onloadeddata = onReady;
    video.onerror = () => reject(new Error("Failed to load source video"));
  });
}

/** Seeks a video element and resolves once the seek completes. */
function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = Math.max(0, time);
  });
}

/**
 * Trims [inPoint, outPoint] from the source blob URL by re-recording.
 * Returns the original blob (fallback) if trimming isn't supported.
 */
export async function trimClip(
  sourceUrl: string,
  inPoint: number,
  outPoint: number,
  sourceBlob: Blob,
): Promise<TrimResult> {
  if (!canCanvasTrim()) {
    return {
      blob: sourceBlob,
      ext: "webm",
      trimmed: false,
      mimeType: sourceBlob.type || "video/webm",
    };
  }

  const video = await loadVideo(sourceUrl);
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      blob: sourceBlob,
      ext: "webm",
      trimmed: false,
      mimeType: sourceBlob.type || "video/webm",
    };
  }

  const fps = 30;
  const stream = canvas.captureStream(fps);
  const { mimeType, ext } = pickMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  // Seek to the IN point before we start drawing.
  await seek(video, inPoint);

  let rafId = 0;
  const start = performance.now();
  const durationMs = Math.max(0, (outPoint - inPoint) * 1000);

  recorder.start();

  await video.play().catch(() => {
    /* autoplay may be blocked; we still drive frames manually below */
  });

  await new Promise<void>((resolve) => {
    const drawFrame = () => {
      const elapsed = performance.now() - start;
      ctx.drawImage(video, 0, 0, width, height);
      if (
        elapsed >= durationMs ||
        video.currentTime >= outPoint ||
        video.ended
      ) {
        cancelAnimationFrame(rafId);
        resolve();
        return;
      }
      rafId = requestAnimationFrame(drawFrame);
    };
    rafId = requestAnimationFrame(drawFrame);
  });

  video.pause();
  if (recorder.state !== "inactive") recorder.stop();
  const blob = await done;

  // Cleanup
  stream.getTracks().forEach((t) => t.stop());

  // Guard against an empty recording (can happen on some Safari versions).
  if (blob.size === 0) {
    return {
      blob: sourceBlob,
      ext: "webm",
      trimmed: false,
      mimeType: sourceBlob.type || "video/webm",
    };
  }

  return { blob, ext, trimmed: true, mimeType };
}
