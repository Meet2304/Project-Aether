"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, VideoOff } from "lucide-react";
import { formatTime } from "@/lib/clipUtils";
import { Button } from "@/components/ui/button";

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
      const stream =
        await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
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
      <main className="screen-enter relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-foreground">
          <VideoOff className="size-7" strokeWidth={1.75} />
        </div>
        <div>
          <p className="label-mono mb-2">Camera</p>
          <h1 className="text-xl font-bold tracking-tight">
            {perm === "denied" ? "Access blocked" : "Camera unavailable"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {perm === "denied"
              ? "To record tricks, allow camera access for this site in your browser settings, then try again."
              : permError}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Button onClick={startCamera} size="lg" className="w-full">
            Try Again
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/">Back to Home</Link>
          </Button>
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

      {/* Viewfinder corner brackets */}
      <div className="pointer-events-none absolute inset-5">
        <span className="absolute left-0 top-0 size-5 border-l-2 border-t-2 border-white/70" />
        <span className="absolute right-0 top-0 size-5 border-r-2 border-t-2 border-white/70" />
        <span className="absolute bottom-0 left-0 size-5 border-b-2 border-l-2 border-white/70" />
        <span className="absolute bottom-0 right-0 size-5 border-b-2 border-r-2 border-white/70" />
      </div>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-5">
        {!recording ? (
          <Link
            href="/"
            aria-label="Back to home"
            className="flex size-11 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white backdrop-blur"
          >
            <ArrowLeft className="size-5" />
          </Link>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-white/40 bg-black/50 px-3 py-1.5 backdrop-blur">
            <span className="size-2.5 animate-pulseDot rounded-full bg-white" />
            <span className="font-mono text-sm font-bold tabular-nums text-white">
              {formatTime(elapsed)}
            </span>
          </div>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
          {recording ? "● Rec" : "Standby"}
        </span>
      </div>

      {perm === "prompt" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center">
          <div className="px-6">
            <div className="mx-auto mb-3 size-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/80">
              Requesting camera
            </p>
          </div>
        </div>
      )}

      {/* Record / stop button */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-10">
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={perm !== "granted"}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className="flex size-20 items-center justify-center rounded-full border-4 border-white bg-transparent transition-transform active:scale-95 disabled:opacity-40"
        >
          <span
            className={
              recording
                ? "size-7 rounded-sm bg-white transition-all"
                : "size-16 rounded-full bg-white transition-all"
            }
          />
        </button>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
          {recording ? "Tap to stop" : "Tap to record"}
        </p>
      </div>
    </main>
  );
}
