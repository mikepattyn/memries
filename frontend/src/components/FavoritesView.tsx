import type { Photo } from "../models/photo";
import { HeartIcon } from "./icons";
import { PhotoGrid } from "./PhotoGrid";

export function FavoritesView({
  photos,
  onOpen,
  onActions,
}: {
  photos: Photo[];
  onOpen: (photo: Photo, origin: HTMLElement, list: Photo[]) => void;
  onActions?: (photo: Photo, origin: HTMLElement) => void;
}) {
  const favorites = photos.filter((photo) => photo.favorite);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 min-[640px]:px-6">
      <h2 className="font-display text-[2.1rem] font-semibold leading-tight tracking-tight text-plum">Favorites</h2>

      {favorites.length === 0 ? (
        <div className="mt-14 flex flex-col items-center text-center" data-empty="favorites">
          <span className="index-pulse grid h-16 w-16 place-items-center rounded-full bg-surface/70 text-peach shadow-soft">
            <HeartIcon className="h-7 w-7" />
          </span>
          <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight text-plum">Nothing starred yet</h3>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink/65">
            Tap the heart on a photo you love and it will gather here, like a little private album.
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-4 text-sm text-ink/60">
            {favorites.length} {favorites.length === 1 ? "memory" : "memories"}
          </p>
          <PhotoGrid
            photos={favorites}
            granularity="week"
            onOpen={(photo, origin) => onOpen(photo, origin, favorites)}
            onActions={onActions}
          />
        </div>
      )}
    </div>
  );
}
