"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, FlagTriangleLeft, FlagTriangleRight } from "lucide-react";
import Timeline from "@/components/Timeline";
import ClipCard from "@/components/ClipCard";
import TrickSelector from "@/components/TrickSelector";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Clip } from "@/lib/types";
import {
  buildFilename,
  colorForIndex,
  formatTimePrecise,
} from "@/lib/clipUtils";

export default function ReviewPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [clips, setClips] = useState<Clip[]>([]);
  const [pendingIn, setPendingIn] = useState<number | null>(null);

  // Naming panel state (open after marking OUT).
  const [naming, setNaming] = useState<null | {
    inPoint: number;
    outPoint: number;
    trick: string;
    stamp: Date;
  }>(null);

  const [showDiscard, setShowDiscard] = useState(false);

  // ---- Load the recorded video from sessionStorage -----------------------
  useEffect(() => {
    const url = sessionStorage.getItem("aether:videoUrl");
    if (!url) {
      setMissing(true);
      return;
    }
    setVideoUrl(url);
  }, []);

  // ---- Resolve webm Infinity-duration quirk ------------------------------
  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.duration === Infinity || isNaN(v.duration)) {
      const onSeeked = () => {
        v.currentTime = 0;
        setDuration(v.duration === Infinity ? 0 : v.duration);
        v.removeEventListener("seeked", onSeeked);
      };
      v.addEventListener("seeked", onSeeked);
      v.currentTime = 1e9;
    } else {
      setDuration(v.duration);
    }
  };

  // ---- Smooth playhead while playing -------------------------------------
  useEffect(() => {
    const tick = () => {
      const v = videoRef.current;
      if (v) setCurrentTime(v.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    if (playing) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  // Live scrubbing. Coalesce rapid pointer moves into one seek per frame so the
  // video keeps up smoothly while the cursor drags.
  const seekRafRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const seek = useCallback(
    (t: number) => {
      const max = duration > 0 && isFinite(duration) ? duration : t;
      const clamped = Math.max(0, Math.min(t, max));
      setCurrentTime(clamped);
      pendingSeekRef.current = clamped;
      if (seekRafRef.current == null) {
        seekRafRef.current = requestAnimationFrame(() => {
          seekRafRef.current = null;
          const v = videoRef.current;
          if (v && pendingSeekRef.current != null) {
            v.currentTime = pendingSeekRef.current;
          }
        });
      }
    },
    [duration]
  );

  // Pause playback while scrubbing so the seek preview is clean.
  const handleScrubStart = useCallback(() => {
    const v = videoRef.current;
    if (v && !v.paused) {
      v.pause();
      setPlaying(false);
    }
  }, []);

  // On release, apply the final precise seek immediately.
  const handleScrubEnd = useCallback(() => {
    if (seekRafRef.current != null) {
      cancelAnimationFrame(seekRafRef.current);
      seekRafRef.current = null;
    }
    const v = videoRef.current;
    if (v && pendingSeekRef.current != null) {
      v.currentTime = pendingSeekRef.current;
    }
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  // ---- Clip marking ------------------------------------------------------
  const markIn = () => {
    setPendingIn(currentTime);
    showToast(`IN marked at ${formatTimePrecise(currentTime)}`, "info");
  };

  const markOut = () => {
    if (pendingIn === null) {
      showToast("Mark an IN point first", "error");
      return;
    }
    if (currentTime <= pendingIn) {
      showToast("OUT must be after IN", "error");
      return;
    }
    setNaming({
      inPoint: pendingIn,
      outPoint: currentTime,
      trick: "Ollie",
      stamp: new Date(),
    });
  };

  const confirmClip = () => {
    if (!naming) return;
    const index = clips.length + 1;
    const filename = buildFilename(naming.trick, index, naming.stamp);
    const clip: Clip = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      trickName: naming.trick,
      inPoint: naming.inPoint,
      outPoint: naming.outPoint,
      filename,
      color: colorForIndex(clips.length),
    };
    setClips((prev) => [...prev, clip]);
    setNaming(null);
    setPendingIn(null);
    showToast("Clip added", "success");
  };

  const discardNaming = () => {
    setNaming(null);
    setPendingIn(null);
  };

  const deleteClip = (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
  };

  // ---- Upload handoff ----------------------------------------------------
  const uploadAll = () => {
    if (clips.length === 0) return;
    sessionStorage.setItem("aether:clips", JSON.stringify(clips));
    router.push("/upload");
  };

  const discardVideo = () => {
    sessionStorage.removeItem("aether:videoUrl");
    sessionStorage.removeItem("aether:videoType");
    sessionStorage.removeItem("aether:videoSize");
    sessionStorage.removeItem("aether:clips");
    router.push("/");
  };

  // ---- Missing video state ------------------------------------------------
  if (missing) {
    return (
      <main className="screen-enter relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="label-mono">Review</p>
        <h1 className="text-xl font-bold tracking-tight">No recording found</h1>
        <p className="text-sm text-muted-foreground">
          Looks like there&apos;s no video to review. Record a trick first.
        </p>
        <Button asChild size="lg" className="w-full max-w-xs">
          <Link href="/record">Go to Recorder</Link>
        </Button>
      </main>
    );
  }

  const namingFilename = naming
    ? buildFilename(naming.trick, clips.length + 1, naming.stamp)
    : "";

  return (
    <main className="screen-enter relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-44">
      <header className="flex items-center justify-between border-b border-border py-3">
        <button
          onClick={() => setShowDiscard(true)}
          className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <h1 className="label-mono text-foreground">Review &amp; Clip</h1>
        <div className="w-16" aria-hidden />
      </header>

      {/* Video player */}
      <div className="frame-ticks relative mt-4">
        <div className="relative overflow-hidden rounded-md border border-foreground bg-black">
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              className="aspect-video w-full bg-black"
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onClick={togglePlay}
            />
          )}
          <div className="absolute left-2.5 top-2.5 rounded-sm bg-black/60 px-2 py-1 font-mono text-[11px] font-medium tabular-nums text-white backdrop-blur">
            {formatTimePrecise(currentTime)} / {formatTimePrecise(duration)}
          </div>
          <button
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="absolute inset-0 flex items-center justify-center"
          >
            {!playing && (
              <span className="flex size-14 items-center justify-center rounded-full bg-white text-black">
                <Play className="size-6 translate-x-0.5" fill="currentColor" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="py-4">
        <Timeline
          duration={duration}
          currentTime={currentTime}
          clips={clips}
          pendingIn={pendingIn}
          onSeek={seek}
          onScrubStart={handleScrubStart}
          onScrubEnd={handleScrubEnd}
        />
      </div>

      {/* IN / OUT readout — the OUT cell live-previews the playhead once IN is
          set, so you can scrub to the exact frame before capturing. */}
      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border">
        <div
          className={`border-r border-border p-3 transition-colors ${
            pendingIn === null ? "bg-secondary" : "bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="label-mono text-foreground">In</span>
            {pendingIn === null && (
              <span className="size-1.5 animate-pulseDot rounded-full bg-foreground" />
            )}
          </div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums">
            {pendingIn !== null ? formatTimePrecise(pendingIn) : "––:––.–"}
          </div>
        </div>
        <div
          className={`p-3 transition-colors ${
            pendingIn !== null ? "bg-secondary" : "bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="label-mono text-foreground">Out</span>
            {pendingIn !== null && (
              <span className="font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
                {Math.max(0, currentTime - pendingIn).toFixed(1)}s
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums">
            {pendingIn !== null ? formatTimePrecise(currentTime) : "––:––.–"}
          </div>
        </div>
      </div>

      {/* Set buttons — the active step is filled, the other is a hairline. */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button
          size="lg"
          variant={pendingIn === null ? "default" : "outline"}
          onClick={markIn}
        >
          <FlagTriangleLeft className="size-4" />
          {pendingIn === null ? "Set IN" : "Reset IN"}
        </Button>
        <Button
          size="lg"
          variant={pendingIn !== null ? "default" : "outline"}
          onClick={markOut}
          disabled={pendingIn === null}
        >
          <FlagTriangleRight className="size-4" />
          Set OUT
        </Button>
      </div>

      <p className="mt-2.5 text-center font-mono text-[11px] text-muted-foreground">
        {pendingIn === null
          ? "Scrub the timeline, then set the IN point."
          : "Scrub to the end of the trick, then set OUT."}
      </p>

      {/* Clip list */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
          <h2 className="label-mono text-foreground">
            02 — Clips ({String(clips.length).padStart(2, "0")})
          </h2>
        </div>
        {clips.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">
            No clips marked yet. Use Mark IN / Mark OUT to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {clips.map((clip, i) => (
              <ClipCard key={clip.id} clip={clip} index={i} onDelete={deleteClip} />
            ))}
          </div>
        )}
      </section>

      {/* Naming bottom sheet (after Mark OUT) */}
      {naming && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-foreground/40 backdrop-blur-[2px]">
          <div className="w-full max-w-md animate-slideUp rounded-t-xl border-x border-t border-foreground bg-card p-5 pb-8 shadow-[0_-4px_0_0_hsl(var(--foreground))]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold tracking-tight">Name this clip</h3>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                <span className="font-bold text-foreground">
                  {formatTimePrecise(naming.inPoint)}
                </span>{" "}
                →{" "}
                <span className="font-bold text-foreground">
                  {formatTimePrecise(naming.outPoint)}
                </span>{" "}
                ({(naming.outPoint - naming.inPoint).toFixed(1)}s)
              </span>
            </div>

            <label className="label-mono mb-1.5 block">Trick</label>
            <TrickSelector
              value={naming.trick}
              onChange={(trick) => setNaming((n) => (n ? { ...n, trick } : n))}
            />

            <div className="mt-4 rounded-md border border-border bg-secondary p-3">
              <div className="label-mono">Filename preview</div>
              <div className="mt-1 break-all font-mono text-xs text-foreground">
                {namingFilename}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="outline" size="lg" onClick={discardNaming}>
                Discard Clip
              </Button>
              <Button size="lg" onClick={confirmClip}>
                Confirm Clip
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-foreground bg-background/95 px-4 pb-6 pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setShowDiscard(true)}
          >
            Discard
          </Button>
          <Button
            size="lg"
            className="flex-[1.5]"
            onClick={uploadAll}
            disabled={clips.length === 0}
          >
            Upload{clips.length > 0 ? ` · ${clips.length}` : ""}
          </Button>
        </div>
      </div>

      {/* Discard confirmation dialog */}
      <Dialog open={showDiscard} onOpenChange={setShowDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this video?</DialogTitle>
            <DialogDescription>
              Your recording and all {clips.length} marked clip
              {clips.length === 1 ? "" : "s"} will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscard(false)}>
              Keep Editing
            </Button>
            <Button onClick={discardVideo}>Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
