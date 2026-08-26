import { useCallback, useMemo, useState } from 'react';
import { AlbumPage } from './components/AlbumPage';
import { AlbumsView } from './components/AlbumsView';
import { AppShell } from './components/AppShell';
import { FavoritesView } from './components/FavoritesView';
import { IndexingScreen } from './components/IndexingScreen';
import { PhotoActionsMenu } from './components/PhotoActionsMenu';
import { PhotoViewer } from './components/PhotoViewer';
import { SearchView } from './components/SearchView';
import { Timeline } from './components/Timeline';
import {
  useAddPhotoToAlbum,
  useAlbums,
  useCreateAlbum,
  useRemovePhotoFromAlbum,
} from './hooks/useAlbums';
import { useIndex } from './hooks/useIndex';
import { flattenPhotos, usePhotos, useToggleFavorite } from './hooks/usePhotos';
import { parseSmartDate } from './lib/parseSmartDate';
import type { Granularity, NavTab, Photo, SearchState } from './models/photo';

const INITIAL_SEARCH: SearchState = {
  query: '',
  years: [],
  favoritesOnly: false,
  openCategory: null,
};

export default function App() {
  const {
    status: indexStatus,
    isError: indexError,
    isReadyForPhotos,
    retry: indexRetry,
    rescan,
    rescanning,
    retrying: indexRetrying,
  } = useIndex();
  const [tab, setTab] = useState<NavTab>('memories');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [search, setSearch] = useState<SearchState>(INITIAL_SEARCH);
  const [lastFocus, setLastFocus] = useState<HTMLElement | null>(null);
  const [viewer, setViewer] = useState<{
    id: string;
    origin: DOMRect | null;
    list: Photo[];
  } | null>(null);
  const [actionsPhoto, setActionsPhoto] = useState<Photo | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [indexVisible, setIndexVisible] = useState(true);

  const timelineQuery = usePhotos(isReadyForPhotos);
  const favoritesQuery = usePhotos(isReadyForPhotos && tab === 'favorites', { favorite: true });
  const parsedDate = useMemo(() => parseSmartDate(search.query, new Date()), [search.query]);
  const searchFilter = useMemo(() => {
    const years = [...search.years];
    for (const year of parsedDate?.years ?? []) {
      if (!years.includes(year)) years.push(year);
    }
    const query = search.query.trim();
    return {
      years: years.length > 0 ? years : undefined,
      months: parsedDate?.months,
      localFrom: parsedDate?.localFrom,
      localTo: parsedDate?.localTo,
      favorite: search.favoritesOnly || undefined,
      q: parsedDate || !query ? undefined : query,
    };
  }, [parsedDate, search.favoritesOnly, search.query, search.years]);
  const searchQuery = usePhotos(isReadyForPhotos && tab === 'search', searchFilter);

  const albumsQuery = useAlbums();
  const favoriteMutation = useToggleFavorite();
  const createAlbumMutation = useCreateAlbum();
  const addPhotoMutation = useAddPhotoToAlbum();
  const removePhotoMutation = useRemovePhotoFromAlbum();

  const activeQuery =
    tab === 'favorites' ? favoritesQuery : tab === 'search' ? searchQuery : timelineQuery;

  const loadSettled = activeQuery.isSuccess || activeQuery.isError;
  const canLeaveIndex = isReadyForPhotos && loadSettled && !rescanning && !indexRetrying;
  const hideIndex = useCallback(() => setIndexVisible(false), []);

  const handleRescan = useCallback(() => {
    setIndexVisible(true);
    rescan();
  }, [rescan]);

  const timelinePhotos = flattenPhotos(timelineQuery.data);
  const favoritesPhotos = flattenPhotos(favoritesQuery.data);
  const searchPhotos = flattenPhotos(searchQuery.data);
  const albums = albumsQuery.data ?? [];

  const tabPhotos =
    tab === 'favorites' ? favoritesPhotos : tab === 'search' ? searchPhotos : timelinePhotos;

  const liveViewerList = viewer
    ? viewer.list.map((item) => tabPhotos.find((photo) => photo.id === item.id) ?? item)
    : [];

  const liveActionsPhoto = actionsPhoto
    ? (tabPhotos.find((photo) => photo.id === actionsPhoto.id) ?? actionsPhoto)
    : null;

  const openPhoto = (photo: Photo, origin: HTMLElement, list: Photo[]) => {
    setLastFocus(origin);
    setViewer({ id: photo.id, origin: origin.getBoundingClientRect(), list });
  };

  const closeViewer = () => {
    setViewer(null);
    lastFocus?.focus();
  };

  const openActions = (photo: Photo, origin: HTMLElement) => {
    setLastFocus(origin);
    setActionsPhoto(photo);
  };

  const closeActions = () => {
    setActionsPhoto(null);
    lastFocus?.focus();
  };

  const toggleFavorite = (id: string, favorite: boolean) => {
    favoriteMutation.mutate({ id, favorite });
  };

  const addToAlbum = (albumId: string, photoId: string) => {
    addPhotoMutation.mutate({ albumId, photoId });
  };

  const changeTab = (next: NavTab) => {
    if (next === tab && next === 'albums') {
      setSelectedAlbumId(null);
      return;
    }
    setTab(next);
    if (next !== 'albums') setSelectedAlbumId(null);
  };

  const showGallery = !indexVisible || canLeaveIndex;

  return (
    <>
      {showGallery && (
        <AppShell tab={tab} onTabChange={changeTab}>
          {activeQuery.isError && (
            <div
              className="flex flex-1 flex-col items-center justify-center px-6 text-center"
              role="alert"
            >
              <p className="font-display text-2xl font-semibold tracking-tight">
                We could not load your photos
              </p>
              <p className="mt-2 max-w-xs text-sm text-ink/65">
                Something went quietly wrong. You can try again in a moment.
              </p>
              <button
                type="button"
                onClick={() => void activeQuery.refetch()}
                className="mt-5 min-h-11 rounded-full bg-plum px-5 text-sm font-medium text-cream"
              >
                Try again
              </button>
            </div>
          )}
          {timelineQuery.isSuccess && tab === 'memories' && (
            <Timeline
              photos={timelinePhotos}
              granularity={granularity}
              onGranularityChange={setGranularity}
              onOpen={openPhoto}
              onActions={openActions}
              hasNextPage={timelineQuery.hasNextPage}
              isFetchingNextPage={timelineQuery.isFetchingNextPage}
              fetchNextPage={() => {
                void timelineQuery.fetchNextPage();
              }}
              fetchError={timelineQuery.isFetchNextPageError}
              onRescan={handleRescan}
              rescanning={rescanning}
              onFilter={() => changeTab('search')}
            />
          )}
          {tab === 'albums' && selectedAlbumId && (
            <AlbumPage
              albumId={selectedAlbumId}
              onBack={() => setSelectedAlbumId(null)}
              onOpen={openPhoto}
              onActions={openActions}
            />
          )}
          {tab === 'albums' && !selectedAlbumId && (
            <AlbumsView
              albums={albums}
              onCreate={(name) => createAlbumMutation.mutate(name)}
              onOpen={(album) => setSelectedAlbumId(album.id)}
              creating={createAlbumMutation.isPending}
            />
          )}
          {favoritesQuery.isSuccess && tab === 'favorites' && (
            <FavoritesView photos={favoritesPhotos} onOpen={openPhoto} onActions={openActions} />
          )}
          {tab === 'search' && !searchQuery.isError && (
            <SearchView
              photos={searchPhotos}
              facetPhotos={timelinePhotos}
              search={search}
              onSearchChange={setSearch}
              onOpen={openPhoto}
              onActions={openActions}
              autoFocus
              ready={searchQuery.isSuccess}
            />
          )}

          {viewer && liveViewerList.length > 0 && (
            <PhotoViewer
              photos={liveViewerList}
              activeId={viewer.id}
              origin={viewer.origin}
              onClose={closeViewer}
              onChange={(id) => setViewer({ ...viewer, id })}
              onToggleFavorite={toggleFavorite}
              albums={albums}
              onAddToAlbum={addToAlbum}
            />
          )}

          {liveActionsPhoto && !viewer && (
            <>
              <div
                className="fixed inset-0 z-[55] bg-black/40"
                aria-hidden
                onClick={closeActions}
              />
              <PhotoActionsMenu
                photo={liveActionsPhoto}
                albums={albums}
                mode={selectedAlbumId ? 'album' : 'library'}
                onClose={closeActions}
                onToggleFavorite={toggleFavorite}
                onAddToAlbum={addToAlbum}
                onRemoveFromAlbum={
                  selectedAlbumId
                    ? () =>
                        removePhotoMutation.mutate({
                          albumId: selectedAlbumId,
                          photoId: liveActionsPhoto.id,
                        })
                    : undefined
                }
              />
            </>
          )}
        </AppShell>
      )}
      {indexVisible && (
        <IndexingScreen
          status={indexStatus}
          leaving={canLeaveIndex}
          onExited={hideIndex}
          onRetry={indexRetry}
          retrying={indexRetrying}
          loadError={indexError && !indexStatus}
        />
      )}
    </>
  );
}
