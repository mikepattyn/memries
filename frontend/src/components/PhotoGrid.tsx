import { layoutPhotos } from "../lib/layoutPhotos";
import type { Granularity, Photo } from "../models/photo";
import { PhotoCard } from "./PhotoCard";

export function PhotoGrid({
  photos,
  granularity,
  onOpen,
}: {
  photos: Photo[];
  granularity: Granularity;
  onOpen: (photo: Photo, origin: HTMLElement) => void;
}) {
  const rows = layoutPhotos(photos, granularity);

  return (
    <div className="flex flex-col gap-2.5 min-[640px]:gap-3">
      {rows.map((row, index) => {
        if (row.kind === "thumbs") {
          return (
            <div
              key={`thumbs-${index}`}
              className="grid grid-cols-4 gap-1.5 min-[640px]:grid-cols-5 min-[680px]:grid-cols-6 min-[800px]:grid-cols-7 min-[1280px]:grid-cols-8"
            >
              {row.photos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} density="thumb" onOpen={onOpen} />
              ))}
            </div>
          );
        }
        if (row.kind === "feature") {
          return <PhotoCard key={row.photo.id} photo={row.photo} density="featured" onOpen={onOpen} />;
        }
        if (row.kind === "landscape") {
          return <PhotoCard key={row.photo.id} photo={row.photo} density="featured" onOpen={onOpen} />;
        }
        if (row.kind === "pair") {
          return (
            <div key={`pair-${index}`} className="grid grid-cols-2 gap-2.5">
              {row.photos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} density="medium" onOpen={onOpen} />
              ))}
            </div>
          );
        }
        if (row.kind === "triple") {
          return (
            <div key={`triple-${index}`} className="grid grid-cols-3 gap-1.5 min-[640px]:gap-2.5">
              {row.photos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} density="medium" onOpen={onOpen} />
              ))}
            </div>
          );
        }
        return <PhotoCard key={row.photo.id} photo={row.photo} density="day" onOpen={onOpen} />;
      })}
    </div>
  );
}
