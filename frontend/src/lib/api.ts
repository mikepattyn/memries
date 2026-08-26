import { wallClockFromExifValue } from "./takenAt";
import type { Album, Photo } from "../models/photo";
import type { IndexStatus } from "./indexStatus";

export type ApiPhoto = {
  _key: string;
  taken_at?: string;
  taken_at_local?: string;
  dims?: { w?: number; h?: number };
  favorite?: boolean;
};

export type ApiAlbumView = {
  id: string;
  name: string;
  created_at: string;
  photo_count: number;
  cover_photo_id?: string;
  photo_ids: string[];
};

export type PhotosPage = {
  photos: Photo[];
  nextCursor: string | null;
};

export type PhotoFilter = {
  years?: string[];
  months?: string[];
  favorite?: boolean;
  q?: string;
  localFrom?: string;
  localTo?: string;
};

export function redirectForStatus(status: number): string | null {
  return status === 401 ? "/oauth/login" : null;
}

export function wallClockFromApi(value: string | undefined): string {
  if (!value) return "";
  const fromExif = wallClockFromExifValue(value);
  if (fromExif) return fromExif;
  return value.length >= 19 ? value.slice(0, 19) : value;
}

export function mapPhoto(raw: ApiPhoto): Photo {
  const id = raw._key;
  return {
    id,
    imageUrl: `/api/original/${encodeURIComponent(id)}`,
    thumbnailUrl: `/api/thumb/${encodeURIComponent(id)}?size=512`,
    takenAt: raw.taken_at_local || wallClockFromApi(raw.taken_at),
    width: raw.dims?.w || 1,
    height: raw.dims?.h || 1,
    favorite: raw.favorite === true,
    alt: "Photo",
  };
}

export function mapAlbum(raw: ApiAlbumView): Album {
  return {
    id: raw.id,
    name: raw.name,
    createdAt: raw.created_at,
    photoCount: raw.photo_count,
    coverPhotoId: raw.cover_photo_id,
    photoIds: raw.photo_ids ?? [],
  };
}

export function flattenPhotoPages(pages: Array<{ photos: Photo[] }>): Photo[] {
  const seen = new Set<string>();
  const out: Photo[] = [];
  for (const page of pages) {
    for (const photo of page.photos) {
      if (seen.has(photo.id)) continue;
      seen.add(photo.id);
      out.push(photo);
    }
  }
  return out;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
  });
  const login = redirectForStatus(res.status);
  if (login) {
    window.location.assign(login);
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res;
}

export async function fetchIndexStatus(): Promise<IndexStatus> {
  const res = await apiFetch("/api/index/status");
  return (await res.json()) as IndexStatus;
}

export async function startIndex(): Promise<IndexStatus> {
  const res = await apiFetch("/api/index", { method: "POST" });
  return (await res.json()) as IndexStatus;
}

export async function fetchPhotosPage(
  cursor?: string,
  filter?: PhotoFilter,
): Promise<PhotosPage> {
  const params = new URLSearchParams({ limit: "50" });
  if (cursor) params.set("cursor", cursor);
  if (filter?.favorite === true) params.set("favorite", "true");
  if (filter?.favorite === false) params.set("favorite", "false");
  if (filter?.q) params.set("q", filter.q);
  if (filter?.localFrom) params.set("local_from", filter.localFrom);
  if (filter?.localTo) params.set("local_to", filter.localTo);
  for (const year of filter?.years ?? []) {
    params.append("year", year);
  }
  for (const month of filter?.months ?? []) {
    params.append("month", month);
  }
  const res = await apiFetch(`/api/photos?${params}`);
  const body = (await res.json()) as { photos?: ApiPhoto[]; next_cursor?: string };
  return {
    photos: (body.photos ?? []).map(mapPhoto),
    nextCursor: body.next_cursor || null,
  };
}

export async function setPhotoFavorite(id: string, favorite: boolean): Promise<void> {
  await apiFetch(`/api/photos/${encodeURIComponent(id)}/favorite`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ favorite }),
  });
}

export async function fetchAlbums(): Promise<Album[]> {
  const res = await apiFetch("/api/albums");
  const body = (await res.json()) as { albums?: ApiAlbumView[] };
  return (body.albums ?? []).map(mapAlbum);
}

export async function createAlbum(name: string): Promise<Album> {
  const res = await apiFetch("/api/albums", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  return mapAlbum((await res.json()) as ApiAlbumView);
}

export async function addPhotoToAlbum(albumId: string, photoId: string): Promise<Album> {
  const res = await apiFetch(`/api/albums/${encodeURIComponent(albumId)}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo_id: photoId }),
  });
  return mapAlbum((await res.json()) as ApiAlbumView);
}

export async function fetchAlbum(id: string): Promise<{ album: Album; photos: Photo[] }> {
  const res = await apiFetch(`/api/albums/${encodeURIComponent(id)}`);
  const body = (await res.json()) as ApiAlbumView & { photos?: ApiPhoto[] };
  return {
    album: mapAlbum(body),
    photos: (body.photos ?? []).map(mapPhoto),
  };
}

export async function removePhotoFromAlbum(albumId: string, photoId: string): Promise<Album> {
  const res = await apiFetch(
    `/api/albums/${encodeURIComponent(albumId)}/photos/${encodeURIComponent(photoId)}`,
    { method: "DELETE" },
  );
  return mapAlbum((await res.json()) as ApiAlbumView);
}
