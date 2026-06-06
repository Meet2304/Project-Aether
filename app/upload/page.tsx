"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle, RotateCw } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/Logo";
import type { Clip, UploadItem } from "@/lib/types";
import { STORAGE_BUCKET } from "@/lib/types";
import { slugifyTrick, withTimestamps } from "@/lib/clipUtils";
import { canCanvasTrim, hasWebCodecs, trimClip } from "@/lib/videoTrim";

export default function UploadPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const startedRef = useRef(false);

  // Source recording + capability, cached so retries can reuse them.
  const videoUrlRef = useRef<string>("");
  const sourceBlobRef = useRef<Blob | null>(null);
  const canTrimRef = useRef<boolean>(true);

  const [items, setItems] = useState<UploadItem[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(true);
  const [trimSupported, setTrimSupported] = useState(true);

  const update = (id: string, patch: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
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

    videoUrlRef.current = videoUrl;
    canTrimRef.current = canTrim;
    setTrimSupported(canTrim);

    setItems(
      clips.map((c) => ({
        ...c,
        status: "queued",
        progress: 0,
        storagePath: `${STORAGE_BUCKET}/${slugifyTrick(c.trickName)}/${c.filename}`,
      })),
    );

    runUploads(clips);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fetch the source recording once and cache it for trims + retries. */
  async function ensureSourceBlob(): Promise<Blob | null> {
    if (sourceBlobRef.current) return sourceBlobRef.current;
    try {
      const blob = await (await fetch(videoUrlRef.current)).blob();
      sourceBlobRef.current = blob;
      return blob;
    } catch {
      return null;
    }
  }

  /**
   * Upload a single clip: trim the segment (when supported), push it to
   * storage, and write the metadata row. Returns true on success. Used for
   * both the initial pass and retries.
   */
  async function uploadOne(clip: Clip): Promise<boolean> {
    update(clip.id, { status: "uploading", progress: 5, error: undefined });

    // Simulated progress (Supabase storage upload has no progress events).
    const ticker = window.setInterval(() => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === clip.id && it.status === "uploading" && it.progress < 90
            ? { ...it, progress: it.progress + 7 }
            : it,
        ),
      );
    }, 250);

    try {
      const supabase = createClient();
      const sourceBlob = await ensureSourceBlob();

      let blob = sourceBlob;
      let filename = clip.filename;
      let contentType = sourceBlob?.type || "video/webm";

      if (sourceBlob && canTrimRef.current) {
        const result = await trimClip(
          videoUrlRef.current,
          clip.inPoint,
          clip.outPoint,
          sourceBlob,
        );
        blob = result.blob;
        contentType = result.mimeType;
        if (!result.trimmed) {
          filename = withTimestamps(clip.filename, clip.inPoint, clip.outPoint);
        } else if (result.ext === "mp4") {
          filename = clip.filename.replace(/\.webm$/i, ".mp4");
        }
      } else if (sourceBlob) {
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
      return true;
    } catch (e) {
      window.clearInterval(ticker);
      update(clip.id, {
        status: "failed",
        progress: 0,
        error: e instanceof Error ? e.message : "Upload failed",
      });
      return false;
    }
  }

  /** Initial sequential pass over every queued clip. */
  async function runUploads(clips: Clip[]) {
    setBusy(true);
    let anyFailed = false;
    for (const clip of clips) {
      const ok = await uploadOne(clip);
      if (!ok) anyFailed = true;
    }
    setBusy(false);
    setDone(true);
    showToast(
      anyFailed ? "Some clips failed to upload" : "All clips uploaded",
      anyFailed ? "error" : "success",
    );
  }

  /** Retry a single failed clip. */
  async function retryOne(clip: Clip) {
    if (busy) return;
    setBusy(true);
    const ok = await uploadOne(clip);
    setBusy(false);
    showToast(ok ? "Clip uploaded" : "Retry failed", ok ? "success" : "error");
  }

  /** Retry every clip currently in the failed state, in order. */
  async function retryAllFailed() {
    if (busy) return;
    const failed = items.filter((i) => i.status === "failed");
    if (failed.length === 0) return;
    setBusy(true);
    let anyFailed = false;
    for (const it of failed) {
      const ok = await uploadOne(it);
      if (!ok) anyFailed = true;
    }
    setBusy(false);
    showToast(
      anyFailed ? "Some clips still failed" : "All clips uploaded",
      anyFailed ? "error" : "success",
    );
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
  const settled = done && !busy && items.length > 0;
  const allUploaded = settled && failedCount === 0;

  return (
    <main className="screen-enter relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-10">
      <header className="border-b border-foreground py-4">
        <div className="flex items-center justify-between">
          <p className="label-mono">{busy ? "Uploading" : "Upload"}</p>
          <Logo showWordmark={false} size={32} />
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
          {settled
            ? allUploaded
              ? "Upload complete"
              : "Upload finished"
            : "Uploading clips"}
        </h1>
        {!trimSupported && (
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            Client-side trimming isn&apos;t supported here — full videos upload
            with IN/OUT points in the filename for server-side trimming.
          </p>
        )}
        {trimSupported && hasWebCodecs() && (
          <p className="mt-1.5 label-mono">Trimming segments client-side</p>
        )}
      </header>

      {/* Summary */}
      {settled && (
        <div className="mt-5 rounded-md border border-foreground bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 flex-none items-center justify-center rounded-md border border-foreground">
              {allUploaded ? (
                <Check className="size-5" strokeWidth={2.5} />
              ) : (
                <AlertTriangle className="size-5" strokeWidth={2} />
              )}
            </span>
            <div className="flex-1">
              <p className="font-mono text-2xl font-bold tabular-nums leading-none">
                {String(doneCount).padStart(2, "0")}
                <span className="text-muted-foreground">
                  /{String(items.length).padStart(2, "0")}
                </span>
              </p>
              <p className="label-mono mt-1.5">
                Uploaded{failedCount > 0 ? ` · ${failedCount} failed` : ""}
              </p>
            </div>
          </div>

          {failedCount > 0 && (
            <Button
              onClick={retryAllFailed}
              variant="outline"
              size="default"
              className="mt-4 w-full"
              disabled={busy}
            >
              <RotateCw className="size-4" />
              Retry {failedCount} failed
            </Button>
          )}

          {allUploaded && (
            <p className="mt-3 text-xs text-muted-foreground">
              Run the skeleton post-processor to add pose overlays.
            </p>
          )}
        </div>
      )}

      {/* Progress list */}
      <div className="mt-5 flex-1 space-y-3">
        {items.map((it) => (
          <UploadRow
            key={it.id}
            item={it}
            busy={busy}
            onRetry={() => retryOne(it)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6">
        {settled ? (
          <Button onClick={recordAnother} size="lg" className="w-full">
            Record Another
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
            Keep this screen open…
          </div>
        )}
        <Link
          href="/"
          className="mt-3 block text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}

function UploadRow({
  item,
  busy,
  onRetry,
}: {
  item: UploadItem;
  busy: boolean;
  onRetry: () => void;
}) {
  const slug = slugifyTrick(item.trickName);

  const statusLabel: Record<UploadItem["status"], string> = {
    queued: "Queued",
    uploading: "Uploading",
    done: "Done",
    failed: "Failed",
  };
  const badgeVariant: Record<
    UploadItem["status"],
    "solid" | "outline" | "muted"
  > = {
    queued: "muted",
    uploading: "outline",
    done: "solid",
    failed: "outline",
  };

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-xs text-foreground">
            {item.filename}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {STORAGE_BUCKET}/{slug}/
          </div>
        </div>
        <Badge variant={badgeVariant[item.status]} className="flex-none">
          {item.status === "failed" && <AlertTriangle className="size-3" />}
          {statusLabel[item.status]}
        </Badge>
      </div>

      {/* Progress: a clean bar while in flight/done, a hatched bar on failure. */}
      <div className="mt-2.5">
        {item.status === "failed" ? (
          <div className="hatch h-1 w-full rounded-full opacity-40" />
        ) : (
          <Progress value={item.progress} />
        )}
      </div>

      {item.status === "failed" && (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
            {item.error || "Upload failed"}
          </p>
          <Button
            onClick={onRetry}
            variant="subtle"
            size="sm"
            disabled={busy}
            className="flex-none"
          >
            <RotateCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
