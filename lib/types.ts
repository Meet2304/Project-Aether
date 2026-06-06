/** A clip marked on the review timeline before upload. */
export interface Clip {
  /** Stable client-side id (used as React key and for ordering). */
  id: string;
  /** Trick name selected/typed for this clip. */
  trickName: string;
  /** IN point in seconds within the recorded video. */
  inPoint: number;
  /** OUT point in seconds within the recorded video. */
  outPoint: number;
  /** Generated filename, e.g. kickflip_20240601_143022_1.webm */
  filename: string;
  /** Highlight color used to render the clip region on the timeline. */
  color: string;
}

/** Upload lifecycle status for the upload screen. */
export type UploadStatus = "queued" | "uploading" | "done" | "failed";

/** Per-clip upload state tracked on the upload screen. */
export interface UploadItem extends Clip {
  status: UploadStatus;
  progress: number; // 0..100
  storagePath: string;
  error?: string;
}

/** A row from the Supabase `clips` table (recently uploaded list). */
export interface ClipRecord {
  id: string;
  trick_name: string;
  filename: string;
  storage_path: string;
  duration_seconds: number | null;
  in_point: number | null;
  out_point: number | null;
  recorded_at: string;
  processed: boolean;
  created_at: string;
}

export const STORAGE_BUCKET = "skateboard-data";
