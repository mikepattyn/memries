/// <reference types="vite/client" />

declare module "virtual:memries-photos" {
  export interface LibraryPhotoEntry {
    id: string;
    imageUrl: string;
    takenAt: string;
    takenAtSource: string;
    width: number;
    height: number;
    alt: string;
  }

  export const libraryPhotos: LibraryPhotoEntry[];
}
