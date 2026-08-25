import type { Photo } from "../models/photo";
import { libraryPhotos } from "virtual:memries-photos";

/**
 * On-disk library. `takenAt` is the EXIF wall-clock (see TAKEN_AT_TAG_ORDER
 * in takenAt.ts); `takenAtSource` on the virtual module records which tag won.
 */
export const seedPhotos: Photo[] = libraryPhotos.map((entry) => ({
  id: entry.id,
  imageUrl: entry.imageUrl,
  thumbnailUrl: entry.imageUrl,
  takenAt: entry.takenAt,
  width: entry.width,
  height: entry.height,
  favorite: false,
  alt: entry.alt || "Photo",
}));
