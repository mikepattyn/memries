import type { Album, Photo } from "../models/photo";
import { seedPhotos } from "../data/photos";

const LATENCY_MS = 420;

let photos: Photo[] = seedPhotos.map(clonePhoto);
let albums: Album[] = [];

function clonePhoto(photo: Photo): Photo {
  return { ...photo, people: photo.people ? [...photo.people] : undefined };
}

function cloneAlbum(album: Album): Album {
  return { ...album, photoIds: [...album.photoIds] };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function fetchPhotos(): Promise<Photo[]> {
  await delay(LATENCY_MS);
  return photos.map(clonePhoto);
}

export async function toggleFavorite(id: string): Promise<Photo> {
  await delay(90);
  const found = photos.find((photo) => photo.id === id);
  if (!found) throw new Error("Photo not found");
  found.favorite = !found.favorite;
  return clonePhoto(found);
}

export async function fetchAlbums(): Promise<Album[]> {
  await delay(LATENCY_MS);
  return albums.map(cloneAlbum);
}

export async function createAlbum(name: string): Promise<Album> {
  await delay(90);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Album name is required");
  const album: Album = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    photoIds: [],
  };
  albums = [album, ...albums];
  return cloneAlbum(album);
}

export function resetPhotoStore(): void {
  photos = seedPhotos.map(clonePhoto);
  albums = [];
}
