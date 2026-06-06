"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/Toast";

interface ImportVideoButtonProps {
  className?: string;
}

/**
 * Lets the user pick a video file from their device and hands it to the review
 * flow using the same sessionStorage contract the recorder uses, so importing
 * and recording converge on the same clip/mark/upload pipeline.
 */
export function ImportVideoButton({ className }: ImportVideoButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file twice still fires onChange.
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      showToast("Please choose a video file", "error");
      return;
    }

    const url = URL.createObjectURL(file);
    sessionStorage.setItem("aether:videoUrl", url);
    sessionStorage.setItem("aether:videoType", file.type || "video/mp4");
    sessionStorage.setItem("aether:videoSize", String(file.size));
    sessionStorage.removeItem("aether:clips");

    router.push("/review");
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={className}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        Import a video
      </Button>
    </>
  );
}
