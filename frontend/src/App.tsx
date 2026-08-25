import { useCallback, useEffect, useState } from "react";
import { AlbumsView } from "./components/AlbumsView";
import { AppShell } from "./components/AppShell";
import { FavoritesView } from "./components/FavoritesView";
import { IndexingScreen } from "./components/IndexingScreen";
import { PhotoViewer } from "./components/PhotoViewer";
import { SearchView } from "./components/SearchView";
import { Timeline } from "./components/Timeline";
import { useAlbums, useCreateAlbum } from "./hooks/useAlbums";
import { usePhotos, useToggleFavorite } from "./hooks/usePhotos";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import type { Granularity, NavTab, Photo, SearchState } from "./models/photo";

const INITIAL_SEARCH: SearchState = {
  query: "",
  places: [],
  years: [],
  favoritesOnly: false,
  openCategory: null,
};

const INDEX_MIN_MS = 2500;

export default function App() {
  const photosQuery = usePhotos();
  const albumsQuery = useAlbums();
  const favoriteMutation = useToggleFavorite();
  const createAlbumMutation = useCreateAlbum();
  const reducedMotion = usePrefersReducedMotion();
  const [tab, setTab] = useState<NavTab>("memories");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [search, setSearch] = useState<SearchState>(INITIAL_SEARCH);
  const [lastFocus, setLastFocus] = useState<HTMLElement | null>(null);
  const [viewer, setViewer] = useState<{
    id: string;
    origin: DOMRect | null;
    list: Photo[];
  } | null>(null);
  const [minIndexDone, setMinIndexDone] = useState(false);
  const [indexVisible, setIndexVisible] = useState(true);

  useEffect(() => {
    const wait = reducedMotion ? 0 : INDEX_MIN_MS;
    const timer = window.setTimeout(() => setMinIndexDone(true), wait);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  const loadSettled = photosQuery.isSuccess || photosQuery.isError;
  const canLeaveIndex = loadSettled && minIndexDone;
  const hideIndex = useCallback(() => setIndexVisible(false), []);

  const photos = photosQuery.data ?? [];
  const albums = albumsQuery.data ?? [];
  const liveViewerList = viewer
    ? viewer.list.map((item) => photos.find((photo) => photo.id === item.id) ?? item)
    : [];

  const openPhoto = (photo: Photo, origin: HTMLElement, list: Photo[]) => {
    setLastFocus(origin);
    setViewer({ id: photo.id, origin: origin.getBoundingClientRect(), list });
  };

  const closeViewer = () => {
    setViewer(null);
    lastFocus?.focus();
  };

  const showGallery = !indexVisible || canLeaveIndex;

  return (
    <>
      {showGallery && (
        <AppShell tab={tab} onTabChange={setTab}>
          {photosQuery.isError && (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <p className="font-display text-2xl font-semibold tracking-tight">We could not open the album</p>
              <p className="mt-2 max-w-xs text-sm text-ink/65">
                Something went quietly wrong. You can try again in a moment.
              </p>
              <button
                type="button"
                onClick={() => void photosQuery.refetch()}
                className="mt-5 min-h-11 rounded-full bg-plum px-5 text-sm font-medium text-cream"
              >
                Try again
              </button>
            </div>
          )}
          {photosQuery.isSuccess && tab === "memories" && (
            <Timeline
              photos={photos}
              granularity={granularity}
              onGranularityChange={setGranularity}
              onOpen={openPhoto}
            />
          )}
          {photosQuery.isSuccess && tab === "albums" && (
            <AlbumsView
              albums={albums}
              photos={photos}
              onCreate={(name) => createAlbumMutation.mutate(name)}
              creating={createAlbumMutation.isPending}
            />
          )}
          {photosQuery.isSuccess && tab === "favorites" && <FavoritesView photos={photos} onOpen={openPhoto} />}
          {photosQuery.isSuccess && tab === "search" && (
            <SearchView photos={photos} search={search} onSearchChange={setSearch} onOpen={openPhoto} autoFocus />
          )}

          {viewer && liveViewerList.length > 0 && (
            <PhotoViewer
              photos={liveViewerList}
              activeId={viewer.id}
              origin={viewer.origin}
              onClose={closeViewer}
              onChange={(id) => setViewer({ ...viewer, id, origin: null })}
              onToggleFavorite={(id) => favoriteMutation.mutate(id)}
            />
          )}
        </AppShell>
      )}
      {indexVisible && <IndexingScreen leaving={canLeaveIndex} onExited={hideIndex} />}
    </>
  );
}
