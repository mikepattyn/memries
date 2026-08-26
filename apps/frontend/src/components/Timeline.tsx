import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { VList, type VListHandle } from 'virtua';
import { groupPhotos, nearestGroupIndex } from '../lib/groupPhotos';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import type { Granularity, Photo } from '../models/photo';
import { GranularitySelector } from './GranularitySelector';
import { PhotoSkeleton } from './PhotoSkeleton';
import { TimelineSection } from './TimelineSection';
import { FilterIcon, TodayIcon } from './icons';

export function Timeline({
  photos,
  granularity,
  onGranularityChange,
  onOpen,
  onActions,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  fetchError,
  onRescan,
  rescanning,
  onFilter,
}: {
  photos: Photo[];
  granularity: Granularity;
  onGranularityChange: (value: Granularity) => void;
  onOpen: (photo: Photo, origin: HTMLElement, list: Photo[]) => void;
  onActions?: (photo: Photo, origin: HTMLElement) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  fetchError?: boolean;
  onRescan?: () => void;
  rescanning?: boolean;
  onFilter?: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const groups = useMemo(() => groupPhotos(photos, granularity), [photos, granularity]);
  const listRef = useRef<VListHandle>(null);
  const anchorRef = useRef<string | null>(null);
  const [activeLabel, setActiveLabel] = useState(groups[0]?.label ?? '');
  const [periodLabel, setPeriodLabel] = useState(groups[0]?.label ?? '');
  const [outgoingPeriod, setOutgoingPeriod] = useState<string | null>(null);
  const [showToday, setShowToday] = useState(false);

  const orderedPhotos = useMemo(() => groups.flatMap((group) => group.photos), [groups]);

  const groupsRef = useRef(groups);

  useLayoutEffect(() => {
    groupsRef.current = groups;
  });

  useLayoutEffect(() => {
    const current = groupsRef.current;
    const nextLabel = current[0]?.label ?? '';
    setActiveLabel(nextLabel);
    setPeriodLabel(nextLabel);
    setOutgoingPeriod(null);
    setShowToday(false);
    const anchor = anchorRef.current;
    if (!anchor || !listRef.current || current.length === 0) return;
    const index = nearestGroupIndex(current, anchor);
    listRef.current.scrollToIndex(index, { align: 'start' });
    if (index > 0) setShowToday(true);
    anchorRef.current = null;
  }, [granularity]);

  const handleGranularity = (next: Granularity) => {
    if (next === granularity) return;
    const handle = listRef.current;
    if (handle) {
      const group = groups[Math.min(handle.findStartIndex(), Math.max(0, groups.length - 1))];
      anchorRef.current = group?.photos[0]?.takenAt ?? null;
    }
    onGranularityChange(next);
  };

  if (activeLabel && activeLabel !== periodLabel) {
    if (reducedMotion) {
      setPeriodLabel(activeLabel);
      setOutgoingPeriod(null);
    } else {
      setOutgoingPeriod(periodLabel);
      setPeriodLabel(activeLabel);
    }
  }

  useEffect(() => {
    if (!outgoingPeriod) return;
    const timer = window.setTimeout(() => setOutgoingPeriod(null), 280);
    return () => window.clearTimeout(timer);
  }, [outgoingPeriod]);

  const openFrom = (photo: Photo, origin: HTMLElement) => {
    onOpen(photo, origin, orderedPhotos);
  };

  const requestNextPage = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || fetchError) return;
    fetchNextPage?.();
  }, [fetchError, fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3 min-[640px]:px-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-[2.1rem] font-semibold leading-tight tracking-tight text-plum">
            Your memries
          </h1>
          {onFilter && (
            <button
              type="button"
              onClick={onFilter}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-surface/70 px-4 text-sm font-medium text-plum shadow-soft transition duration-200 active:scale-[0.98]"
            >
              <FilterIcon className="h-4 w-4" />
              Filter
            </button>
          )}
        </div>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink/70">
          A quiet place for the days you want to keep.
        </p>
      </div>

      <div className="sticky top-0 z-20 bg-cream/75 px-4 py-2 backdrop-blur-xl min-[640px]:px-6 min-[800px]:bg-surface/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <GranularitySelector value={granularity} onChange={handleGranularity} />
          {onRescan && (
            <button
              type="button"
              onClick={onRescan}
              disabled={rescanning}
              className="min-h-9 rounded-full px-3 text-xs font-medium text-ink/60 transition hover:text-plum disabled:opacity-50"
            >
              {rescanning ? 'Syncing…' : 'Sync folder'}
            </button>
          )}
        </div>
        {periodLabel && (
          <div className="relative mt-2 min-h-4 px-1">
            {outgoingPeriod && (
              <span
                className="period-out pointer-events-none absolute inset-x-1 text-xs font-medium text-ink/65"
                aria-hidden
              >
                {outgoingPeriod}
              </span>
            )}
            <p
              className={`text-xs font-medium text-ink/65 ${reducedMotion || !outgoingPeriod ? '' : 'period-in'}`}
              aria-live="polite"
              aria-label="Current period"
              data-current-period
              data-period-motion={outgoingPeriod ? 'crossfade' : 'idle'}
            >
              {periodLabel}
            </p>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center" role="status">
            <p className="text-ink/70">No memories here yet.</p>
            {onRescan && (
              <button
                type="button"
                onClick={onRescan}
                disabled={rescanning}
                className="mt-5 min-h-11 rounded-full bg-plum px-5 text-sm font-medium text-cream disabled:opacity-60"
              >
                {rescanning ? 'Scanning your folder…' : 'Scan your folder'}
              </button>
            )}
          </div>
        ) : (
          <div
            key={granularity}
            data-timeline
            data-group-count={groups.length}
            data-timeline-motion={reducedMotion ? 'none' : 'fade-rise'}
            className={`h-full ${reducedMotion ? '' : 'animate-fade-rise'}`}
            ref={(node) => {
              if (!node) return;
              Object.assign(node, {
                __scrollToGroup(index: number) {
                  const current = groupsRef.current;
                  const max = Math.max(0, current.length - 1);
                  const next = Math.min(Math.max(0, index), max);
                  listRef.current?.scrollToIndex(next, { align: 'start' });
                  const label = current[next]?.label;
                  if (label) setActiveLabel(label);
                  setShowToday(next > 0);
                },
              });
            }}
          >
            <VList
              ref={listRef}
              style={{ height: '100%' }}
              onScroll={(offset) => {
                const handle = listRef.current;
                const start = handle?.findStartIndex() ?? 0;
                setShowToday(offset > 280 && start > 0);
                const label = groups[start]?.label;
                if (label) setActiveLabel(label);
                if (start >= Math.max(0, groups.length - 2)) requestNextPage();
              }}
            >
              {groups.map((group) => (
                <TimelineSection
                  key={`${granularity}-${group.key}`}
                  group={group}
                  granularity={granularity}
                  onOpen={openFrom}
                  onActions={onActions}
                  showHeading
                />
              ))}
              <div className="px-4 pb-8 min-[640px]:px-6">
                <LoadMoreMarker
                  onVisible={requestNextPage}
                  enabled={!!hasNextPage && !isFetchingNextPage && !fetchError}
                />
                {isFetchingNextPage && (
                  <p className="py-3 text-center text-sm text-ink/60" aria-live="polite">
                    Loading more memories…
                  </p>
                )}
                {fetchError && (
                  <div className="flex flex-col items-center gap-3 py-4 text-center" role="alert">
                    <p className="text-sm text-ink/65">More memories did not load.</p>
                    <button
                      type="button"
                      onClick={() => fetchNextPage?.()}
                      className="min-h-11 rounded-full bg-plum px-5 text-sm font-medium text-cream"
                    >
                      Try again
                    </button>
                  </div>
                )}
                {!hasNextPage && !isFetchingNextPage && <div className="h-8" />}
              </div>
            </VList>
          </div>
        )}

        {showToday && (
          <button
            type="button"
            onClick={() =>
              listRef.current?.scrollToIndex(0, { align: 'start', smooth: !reducedMotion })
            }
            className={`absolute bottom-4 right-4 z-20 flex min-h-11 items-center gap-2 rounded-full bg-plum px-4 py-2 text-sm font-medium text-cream shadow-lift transition duration-200 active:scale-95 min-[800px]:bottom-6 min-[800px]:right-6 ${
              reducedMotion ? '' : 'animate-fab-in'
            }`}
            aria-label="Back to today"
            data-today-fab
          >
            <TodayIcon className="h-4 w-4" />
            Today
          </button>
        )}
      </div>
    </div>
  );
}

function LoadMoreMarker({ onVisible, enabled }: { onVisible: () => void; enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisible();
      },
      { rootMargin: '320px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onVisible]);
  return <div ref={ref} className="h-px w-full" aria-hidden />;
}

export function TimelineLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-4 min-[640px]:px-6">
        <div className="skeleton mb-2 h-3 w-24 rounded-full" />
        <div className="skeleton h-8 w-48 rounded-full" />
      </div>
      <div className="px-4 min-[640px]:px-6">
        <div className="skeleton mb-6 h-12 w-full rounded-full" />
        <PhotoSkeleton />
      </div>
    </div>
  );
}
