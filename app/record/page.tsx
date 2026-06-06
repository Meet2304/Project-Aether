"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatTime } from "@/lib/clipUtils";

type PermissionState = "prompt" | "granted" | "denied" | "error";

const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};

/** Chooses the best supported webm-first recording mimeType. */
function pickRecorderMime(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c)
    ) {
      return c;
    }
  }
  return "video/webm";
}

export default function RecordPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [perm, setPerm] = useState<PermissionState>("prompt");
  const [permError, setPermError] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setPerm("prompt");
    setPermError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPerm("error");
        setPermError("Camera API is not available in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPerm("granted");
    } catch (e) {
      const err = e as DOMException;
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setPerm("denied");
      } else {
        setPerm("error");
        setPermError(err?.message || "Could not access the camera.");
      }
    }
  }, []);

  // Acquire the camera on mount; release everything on unmount.
  useEffect(() => {
    startCamera();
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = pickRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(streamRef.current, { mimeType });
    } catch {
      recorder = new MediaRecorder(streamRef.current);
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "video/webm",
      });
      const url = URL.createObjectURL(blob);
      // Hand the recording off to the review screen via sessionStorage.
      sessionStorage.setItem("aether:videoUrl", url);
      sessionStorage.setItem("aether:videoType", blob.type || "video/webm");
      sessionStorage.setItem("aether:videoSize", String(blob.size));
      stopStream();
      router.push("/review");
    };

    recorder.start(100); // gather data in 100ms timeslices
    setRecording(true);
    setElapsed(0);
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsed((Date.now() - startedAt) / 1000);
    }, 200);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  // ---- Permission / error states -----------------------------------------

  if (perm === "denied" || perm === "error") {
    return (
      <main className="screen-enter mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1l22 22" />
            <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m4-2h4l2 2h2a2 2 0 0 1 2 2v9.34" />
            <path d="M9.5 9.5a3 3 0 0 0 4 4" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold">
            {perm === "denied" ? "Camera access blocked" : "Camera unavailable"}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            {perm === "denied"
              ? "To record tricks, allow camera access for this site in your browser settings, then try again."
              : permError}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={startCamera}
            className="h-12 w-full rounded-xl bg-accent text-base font-semibold text-white active:scale-[0.98]"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="flex h-12 w-full items-center justify-center rounded-xl border border-neutral-700 text-base font-medium text-neutral-300"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  // ---- Viewfinder ---------------------------------------------------------

  return (
    <main className="fixed inset-0 z-10 bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        autoPlay
        muted
        playsInline
      />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4">
        {!recording ? (
          <Link
            href="/"
            aria-label="Back to home"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
        ) : (
          <div className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur">
            <span className="h-3 w-3 animate-pulseDot rounded-full bg-red-500" />
            <span className="text-sm font-semibold tabular-nums text-white">
              {formatTime(elapsed)}
            </span>
          </div>
        )}
        <div className="h-11 w-11" aria-hidden />
      </div>

      {perm === "prompt" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-center">
          <div className="px-6">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-neutral-600 border-t-accent" />
            <p className="text-sm text-neutral-300">Requesting camera…</p>
          </div>
        </div>
      )}

      {/* Record / stop button */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-10">
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={perm !== "granted"}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 bg-transparent transition-transform active:scale-95 disabled:opacity-40"
        >
          <span
            className={
              recording
                ? "h-7 w-7 rounded-md bg-red-500 transition-all"
                : "h-16 w-16 rounded-full bg-red-500 transition-all"
            }
          />
        </button>
        <p className="mt-3 text-xs text-white/70">
          {recording ? "Tap to stop" : "Tap to record"}
        </p>
      </div>
    </main>
  );
}
