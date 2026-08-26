import { useAlbum } from '../hooks/useAlbums';
import type { Photo } from '../models/photo';
import { ChevronLeftIcon } from './icons';
import { PhotoGrid } from './PhotoGrid';

export function AlbumPage({
  albumId,
  onBack,
  onOpen,
  onActions,
}: {
  albumId: string;
  onBack: () => void;
  onOpen: (photo: Photo, origin: HTMLElement, list: Photo[]) => void;
  onActions?: (photo: Photo, origin: HTMLElement) => void;
}) {
  const query = useAlbum(albumId);
  const album = query.data?.album;
  const photos = query.data?.photos ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 min-[640px]:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-surface/70 px-4 text-sm font-medium text-plum shadow-soft"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Back to albums
      </button>

      {query.isPending && (
        <p className="mt-10 text-center text-sm text-ink/60" role="status" aria-live="polite">
          Opening this album…
        </p>
      )}

      {query.isError && (
        <div className="mt-10 text-center" role="alert">
          <p className="font-display text-2xl font-semibold tracking-tight text-plum">
            We could not open this album
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-5 min-h-11 rounded-full bg-plum px-5 text-sm font-medium text-cream"
          >
            Try again
          </button>
        </div>
      )}

      {query.isSuccess && album && (
        <>
          <h1 className="font-display text-[2.1rem] font-semibold leading-tight tracking-tight text-plum">
            {album.name}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {album.photoCount} {album.photoCount === 1 ? 'photo' : 'photos'}
          </p>
          {photos.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink/60">No photos in this album yet.</p>
          ) : (
            <div className="mt-5">
              <PhotoGrid
                photos={photos}
                granularity="year"
                onOpen={(photo, origin) => onOpen(photo, origin, photos)}
                onActions={onActions}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
