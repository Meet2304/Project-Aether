"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/Toast";
import type { Clip, UploadItem } from "@/lib/types";
import { STORAGE_BUCKET } from "@/lib/types";
import { slugifyTrick, withTimestamps } from "@/lib/clipUtils";
import { canCanvasTrim, hasWebCodecs, trimClip } from "@/lib/videoTrim";

export default function UploadPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const startedRef = useRef(false);

  const [items, setItems] = useState<UploadItem[]>([]);
  const [done, setDone] = useState(false);
  const [trimSupported, setTrimSupported] = useState(true);

  const update = (id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const raw = sessionStorage.getItem("aether:clips");
    const videoUrl = sessionStorage.getItem("aether:videoUrl");
    if (!raw || !videoUrl) {
      router.replace("/");
      return;
    }
    const clips: Clip[] = JSON.parse(raw);
    const canTrim = canCanvasTrim();
    setTrimSupported(canTrim);

    setItems(
      clips.map((c) => ({
        ...c,
        status: "queued",
        progress: 0,
        storagePath: `${STORAGE_BUCKET}/${slugifyTrick(c.trickName)}/${c.filename}`,
      }))
    );

    runUploads(clips, videoUrl, canTrim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runUploads(clips: Clip[], videoUrl: string, canTrim: boolean) {
    const supabase = createClient();

    // Fetch the source recording once so we can trim segments from it.
    let sourceBlob: Blob | null = null;
    try {
      sourceBlob = await (await fetch(videoUrl)).blob();
    } catch {
      sourceBlob = null;
    }

    let anyFailed = false;

    for (const clip of clips) {
      update(clip.id, { status: "uploading", progress: 5 });

      // Simulated progress (Supabase storage upload has no progress events).
      const ticker = window.setInterval(() => {
        setItems((prev) =>
          prev.map((it) =>
            it.id === clip.id && it.status === "uploading" && it.progress < 90
              ? { ...it, progress: it.progress + 7 }
              : it
          )
        );
      }, 250);

      try {
        let blob = sourceBlob;
        let filename = clip.filename;
        let contentType = sourceBlob?.type || "video/webm";

        if (sourceBlob && canTrim) {
          const result = await trimClip(
            videoUrl,
            clip.inPoint,
            clip.outPoint,
            sourceBlob
          );
          blob = result.blob;
          contentType = result.mimeType;
          if (!result.trimmed) {
            // Trimming silently failed → fall back to metadata in filename.
            filename = withTimestamps(clip.filename, clip.inPoint, clip.outPoint);
          } else if (result.ext === "mp4") {
            filename = clip.filename.replace(/\.webm$/i, ".mp4");
          }
        } else if (sourceBlob) {
          // No trimming support → upload full video with IN/OUT in filename.
          filename = withTimestamps(clip.filename, clip.inPoint, clip.outPoint);
        }

        if (!blob) throw new Error("No video data available to upload");

        const slug = slugifyTrick(clip.trickName);
        const path = `${slug}/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, blob, {
            contentType,
            upsert: true,
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;

        // Write the metadata row.
        const { error: dbError } = await supabase.from("clips").insert({
          trick_name: clip.trickName,
          filename,
          storage_path: `${STORAGE_BUCKET}/${path}`,
          duration_seconds: Number((clip.outPoint - clip.inPoint).toFixed(3)),
          in_point: Number(clip.inPoint.toFixed(3)),
          out_point: Number(clip.outPoint.toFixed(3)),
          processed: false,
        });

        if (dbError) throw dbError;

        window.clearInterval(ticker);
        update(clip.id, {
          status: "done",
          progress: 100,
          filename,
          storagePath: `${STORAGE_BUCKET}/${path}`,
        });
      } catch (e) {
        window.clearInterval(ticker);
        anyFailed = true;
        update(clip.id, {
          status: "failed",
          progress: 100,
          error: e instanceof Error ? e.message : "Upload failed",
        });
      }
    }

    setDone(true);
    if (anyFailed) {
      showToast("Some clips failed to upload", "error");
    } else {
      showToast("All clips uploaded", "success");
    }
  }

  const recordAnother = () => {
    sessionStorage.removeItem("aether:videoUrl");
    sessionStorage.removeItem("aether:videoType");
    sessionStorage.removeItem("aether:videoSize");
    sessionStorage.removeItem("aether:clips");
    router.push("/");
  };

  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const allDone = done && items.length > 0;

  return (
    <main className="screen-enter mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-10">
      <header className="py-5 text-center">
        <h1 className="text-lg font-semibold">
          {allDone ? "Upload complete" : "Uploading clips"}
        </h1>
        {!trimSupported && (
          <p className="mx-auto mt-2 max-w-xs text-xs text-amber-400/80">
            Client-side trimming isn&apos;t supported on this browser — full
            videos are uploaded with IN/OUT points in the filename for
            server-side trimming.
          </p>
        )}
        {trimSupported && hasWebCodecs() && (
          <p className="mt-1 text-[11px] text-neutral-600">
            Trimming segments client-side
          </p>
        )}
      </header>

      {/* Success summary */}
      {allDone && (
        <div
          className={`mb-5 rounded-2xl border p-5 text-center ${
            failedCount === 0
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-amber-500/30 bg-amber-500/5"
          }`}
        >
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            {failedCount === 0 ? (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <span className="text-2xl">!</span>
            )}
          </div>
          <p className="text-sm text-neutral-200">
            {doneCount} of {items.length} clip{items.length === 1 ? "" : "s"}{" "}
            uploaded
            {failedCount > 0 ? `, ${failedCount} failed` : ""}.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Run the skeleton post-processor to add pose overlays.
          </p>
        </div>
      )}

      {/* Progress list */}
      <div className="flex-1 space-y-3">
        {items.map((it) => (
          <UploadRow key={it.id} item={it} />
        ))}
      </div>

      {/* Footer actions */}
      <div className="mt-6">
        {allDone ? (
          <button
            onClick={recordAnother}
            className="h-12 w-full rounded-xl bg-accent font-semibold text-white active:scale-[0.98]"
          >
            Record Another
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-accent" />
            Please keep this screen open…
          </div>
        )}
        <Link
          href="/"
          className="mt-3 block text-center text-xs text-neutral-600"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  const slug = slugifyTrick(item.trickName);
  const statusLabel: Record<UploadItem["status"], string> = {
    queued: "Queued",
    uploading: "Uploading",
    done: "Done",
    failed: "Failed",
  };
  const statusColor: Record<UploadItem["status"], string> = {
    queued: "text-neutral-500",
    uploading: "text-accent",
    done: "text-emerald-400",
    failed: "text-red-400",
  };
  const barColor =
    item.status === "failed"
      ? "bg-red-500"
      : item.status === "done"
        ? "bg-emerald-500"
        : "bg-accent";

  return (
    <div className="rounded-xl border border-neutral-800 bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-xs text-neutral-200">
            {item.filename}
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-500">
            {STORAGE_BUCKET}/{slug}/
          </div>
        </div>
        <span className={`flex-none text-xs font-semibold ${statusColor[item.status]}`}>
          {statusLabel[item.status]}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${item.progress}%` }}
        />
      </div>
      {item.error && (
        <p className="mt-1.5 text-[11px] text-red-400/80">{item.error}</p>
      )}
    </div>
  );
}
