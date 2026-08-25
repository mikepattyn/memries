export type Granularity = "year" | "month" | "week" | "day";

export interface Bucket {
  bucket: string;
  count: number;
  cover_photo_id: string;
  first: string;
  last: string;
}

export interface TimelineResp {
  granularity: Granularity;
  from: string;
  to: string;
  buckets: Bucket[];
}

export interface Photo {
  _key: string;
  kind: "photo" | "video";
  taken_at: string;
  taken_at_local?: string;
  tz_offset: number;
  dims: { w: number; h: number };
  mime: string;
  exif?: Record<string, unknown>;
}

export interface PhotosResp {
  photos: Photo[];
  next_cursor: string;
}

export interface Me {
  Key: string;
  Email: string;
  Name: string;
}

const API_BASE = (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_API_BASE ?? "";

async function jget<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (r.status === 401) {
    window.location.href = `${API_BASE}/oauth/login`;
    throw new Error("unauthorized");
  }
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export function fetchMe() {
  return jget<Me>("/api/me");
}

export function fetchTimeline(granularity: Granularity, from: string, to: string) {
  const qs = new URLSearchParams({ granularity, from, to });
  return jget<TimelineResp>(`/api/timeline?${qs}`);
}

export function fetchPhotos(from: string, to: string, cursor?: string) {
  const qs = new URLSearchParams({ from, to });
  if (cursor) qs.set("cursor", cursor);
  qs.set("limit", "200");
  return jget<PhotosResp>(`/api/photos?${qs}`);
}

export function thumbURL(id: string, size: 256 | 512 | 1024 = 256) {
  return `${API_BASE}/api/thumb/${id}?size=${size}`;
}

export function originalURL(id: string) {
  return `${API_BASE}/api/original/${id}`;
}
