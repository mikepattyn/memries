import { useVisibleRowRange } from '../hooks/useVisibleRowRange';
import { useViewportWidth } from '../hooks/useViewportWidth';
import { chunkIntoRows, rowWindow, thumbsGridColumns } from '../lib/keepWindow';
import { layoutPhotos } from '../lib/layoutPhotos';
import type { Granularity, Photo } from '../models/photo';
import { PhotoCard } from './PhotoCard';

export function PhotoGrid({
  photos,
  granularity,
  onOpen,
  onActions,
}: {
  photos: Photo[];
  granularity: Granularity;
  onOpen: (photo: Photo, origin: HTMLElement) => void;
  onActions?: (photo: Photo, origin: HTMLElement) => void;
}) {
  const rows = layoutPhotos(photos, granularity);

  return (
    <div className="flex flex-col gap-2.5 min-[640px]:gap-3">
      {rows.map((row, index) => {
        if (row.kind === 'thumbs') {
          return (
            <CompactThumbs
              key={`thumbs-${index}`}
              photos={row.photos}
              onOpen={onOpen}
              onActions={onActions}
            />
          );
        }
        if (row.kind === 'feature') {
          return (
            <PhotoCard
              key={row.photo.id}
              photo={row.photo}
              density="featured"
              revealIndex={index}
              onOpen={onOpen}
              onActions={onActions}
            />
          );
        }
        if (row.kind === 'landscape') {
          return (
            <PhotoCard
              key={row.photo.id}
              photo={row.photo}
              density="featured"
              revealIndex={index}
              onOpen={onOpen}
              onActions={onActions}
            />
          );
        }
        if (row.kind === 'pair') {
          return (
            <div key={`pair-${index}`} className="grid grid-cols-2 gap-2.5">
              {row.photos.map((photo, photoIndex) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  density="medium"
                  revealIndex={index * 2 + photoIndex}
                  onOpen={onOpen}
                  onActions={onActions}
                />
              ))}
            </div>
          );
        }
        if (row.kind === 'triple') {
          return (
            <div key={`triple-${index}`} className="grid grid-cols-3 gap-1.5 min-[640px]:gap-2.5">
              {row.photos.map((photo, photoIndex) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  density="medium"
                  revealIndex={index * 3 + photoIndex}
                  onOpen={onOpen}
                  onActions={onActions}
                />
              ))}
            </div>
          );
        }
        return (
          <PhotoCard
            key={row.photo.id}
            photo={row.photo}
            density="day"
            revealIndex={index}
            onOpen={onOpen}
            onActions={onActions}
          />
        );
      })}
    </div>
  );
}

function CompactThumbs({
  photos,
  onOpen,
  onActions,
}: {
  photos: Photo[];
  onOpen: (photo: Photo, origin: HTMLElement) => void;
  onActions?: (photo: Photo, origin: HTMLElement) => void;
}) {
  const width = useViewportWidth();
  const columns = thumbsGridColumns(width);
  const visualRows = chunkIntoRows(photos, columns);
  const { first, last, bindRow } = useVisibleRowRange(visualRows.length);
  const keep = rowWindow(visualRows.length, first, last);

  return (
    <div className="flex flex-col gap-1.5">
      {visualRows.map((rowPhotos, rowIndex) => (
        <div
          key={rowPhotos.map((photo) => photo.id).join('-')}
          ref={bindRow(rowIndex)}
          className="grid grid-cols-4 gap-1.5 min-[640px]:grid-cols-5 min-[680px]:grid-cols-6 min-[800px]:grid-cols-7 min-[1280px]:grid-cols-8"
        >
          {rowPhotos.map((photo, photoIndex) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              density="thumb"
              showImage={rowIndex >= keep.start && rowIndex < keep.end}
              revealIndex={rowIndex * columns + photoIndex}
              onOpen={onOpen}
              onActions={onActions}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
