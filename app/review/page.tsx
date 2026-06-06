"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Timeline from "@/components/Timeline";
import ClipCard from "@/components/ClipCard";
import TrickSelector from "@/components/TrickSelector";
import { useToast } from "@/components/Toast";
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
      // Force the browser to compute the real duration by seeking far ahead.
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

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setCurrentTime(t);
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
      <main className="screen-enter mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-semibold">No recording found</h1>
        <p className="text-sm text-neutral-400">
          Looks like there&apos;s no video to review. Record a trick first.
        </p>
        <Link
          href="/record"
          className="flex h-12 w-full max-w-xs items-center justify-center rounded-xl bg-accent font-semibold text-white"
        >
          Go to Recorder
        </Link>
      </main>
    );
  }

  const namingFilename = naming
    ? buildFilename(naming.trick, clips.length + 1, naming.stamp)
    : "";

  return (
    <main className="screen-enter mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-44">
      <header className="flex items-center justify-between py-3">
        <button
          onClick={() => setShowDiscard(true)}
          className="flex h-10 items-center gap-1 rounded-lg px-2 text-sm text-neutral-400"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Review &amp; Clip
        </h1>
        <div className="w-16" aria-hidden />
      </header>

      {/* Video player (top half) */}
      <div className="relative overflow-hidden rounded-2xl bg-black">
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
        {/* Current timestamp overlay */}
        <div className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium tabular-nums text-white backdrop-blur">
          {formatTimePrecise(currentTime)} / {formatTimePrecise(duration)}
        </div>
        {/* Play / pause */}
        <button
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="absolute inset-0 flex items-center justify-center"
        >
          {!playing && (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          )}
        </button>
      </div>

      {/* Timeline (middle) */}
      <div className="py-4">
        <Timeline
          duration={duration}
          currentTime={currentTime}
          clips={clips}
          pendingIn={pendingIn}
          onSeek={seek}
        />
      </div>

      {/* Mark controls */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={markIn}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-marker-in/60 bg-marker-in/10 font-semibold text-marker-in active:scale-[0.98]"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-marker-in" />
          Mark IN
        </button>
        <button
          onClick={markOut}
          disabled={pendingIn === null}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-marker-out/60 bg-marker-out/10 font-semibold text-marker-out active:scale-[0.98] disabled:opacity-40"
        >
          <span className="h-2.5 w-2.5 rounded-sm bg-marker-out" />
          Mark OUT
        </button>
      </div>

      {pendingIn !== null && !naming && (
        <p className="mt-2 text-center text-xs text-neutral-500">
          IN set at{" "}
          <span className="text-marker-in">{formatTimePrecise(pendingIn)}</span>
          . Scrub forward and tap{" "}
          <span className="text-marker-out">Mark OUT</span>.
        </p>
      )}

      {/* Clip list */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Clips ({clips.length})
        </h2>
        {clips.length === 0 ? (
          <p className="rounded-xl border border-neutral-800 bg-surface p-4 text-center text-sm text-neutral-500">
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

      {/* Naming panel (inline, after Mark OUT) */}
      {naming && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md animate-slideUp rounded-t-2xl border-t border-neutral-800 bg-surface p-5 pb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Name this clip</h3>
              <span className="text-xs tabular-nums text-neutral-400">
                <span className="text-marker-in">
                  {formatTimePrecise(naming.inPoint)}
                </span>{" "}
                →{" "}
                <span className="text-marker-out">
                  {formatTimePrecise(naming.outPoint)}
                </span>{" "}
                ({(naming.outPoint - naming.inPoint).toFixed(1)}s)
              </span>
            </div>

            <label className="mb-1 block text-xs font-medium text-neutral-400">
              Trick
            </label>
            <TrickSelector
              value={naming.trick}
              onChange={(trick) => setNaming((n) => (n ? { ...n, trick } : n))}
            />

            <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <div className="text-[10px] uppercase tracking-wide text-neutral-500">
                Filename preview
              </div>
              <div className="mt-1 break-all font-mono text-xs text-accent">
                {namingFilename}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={discardNaming}
                className="h-12 rounded-xl border border-neutral-700 font-semibold text-neutral-300 active:scale-[0.98]"
              >
                Discard Clip
              </button>
              <button
                onClick={confirmClip}
                className="h-12 rounded-xl bg-accent font-semibold text-white active:scale-[0.98]"
              >
                Confirm Clip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-background/95 px-4 pb-6 pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md gap-3">
          <button
            onClick={() => setShowDiscard(true)}
            className="h-12 flex-1 rounded-xl border border-neutral-700 font-semibold text-neutral-300 active:scale-[0.98]"
          >
            Discard Video
          </button>
          <button
            onClick={uploadAll}
            disabled={clips.length === 0}
            className="h-12 flex-[1.4] rounded-xl bg-accent font-semibold text-white active:scale-[0.98] disabled:opacity-40"
          >
            Upload All Clips{clips.length > 0 ? ` (${clips.length})` : ""}
          </button>
        </div>
      </div>

      {/* Discard confirmation dialog */}
      {showDiscard && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm animate-slideUp rounded-2xl border border-neutral-800 bg-surface p-5">
            <h3 className="text-base font-semibold">Discard this video?</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Your recording and all {clips.length} marked clip
              {clips.length === 1 ? "" : "s"} will be lost.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDiscard(false)}
                className="h-12 rounded-xl border border-neutral-700 font-semibold text-neutral-300"
              >
                Keep Editing
              </button>
              <button
                onClick={discardVideo}
                className="h-12 rounded-xl bg-red-500 font-semibold text-white"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
