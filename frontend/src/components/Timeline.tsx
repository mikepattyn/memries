import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { VList, type VListHandle } from "virtua";
import { groupPhotos, nearestGroupIndex } from "../lib/groupPhotos";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import type { Granularity, Photo } from "../models/photo";
import { GranularitySelector } from "./GranularitySelector";
import { PhotoSkeleton } from "./PhotoSkeleton";
import { TimelineSection } from "./TimelineSection";
import { TodayIcon } from "./icons";

export function Timeline({
  photos,
  granularity,
  onGranularityChange,
  onOpen,
}: {
  photos: Photo[];
  granularity: Granularity;
  onGranularityChange: (value: Granularity) => void;
  onOpen: (photo: Photo, origin: HTMLElement, list: Photo[]) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const groups = useMemo(() => groupPhotos(photos, granularity), [photos, granularity]);
  const listRef = useRef<VListHandle>(null);
  const anchorRef = useRef<string | null>(null);
  const [activeLabel, setActiveLabel] = useState(groups[0]?.label ?? "");
  const [showToday, setShowToday] = useState(false);

  const orderedPhotos = useMemo(() => groups.flatMap((group) => group.photos), [groups]);

  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  useLayoutEffect(() => {
    const current = groupsRef.current;
    setActiveLabel(current[0]?.label ?? "");
    setShowToday(false);
    const anchor = anchorRef.current;
    if (!anchor || !listRef.current || current.length === 0) return;
    const index = nearestGroupIndex(current, anchor);
    listRef.current.scrollToIndex(index, { align: "start" });
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

  const openFrom = (photo: Photo, origin: HTMLElement) => {
    onOpen(photo, origin, orderedPhotos);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3 min-[640px]:px-6">
        <h2 className="font-display text-[2.1rem] font-semibold leading-tight tracking-tight text-plum">Your memries</h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink/70">
          A quiet place for the days you want to keep.
        </p>
      </div>

      <div className="sticky top-0 z-20 bg-cream/75 px-4 py-2 backdrop-blur-xl min-[640px]:px-6 min-[800px]:bg-surface/40">
        <GranularitySelector value={granularity} onChange={handleGranularity} />
        {activeLabel && (
          <p className="mt-2 px-1 text-xs font-medium text-ink/65" aria-live="polite">
            {activeLabel}
          </p>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {groups.length === 0 ? (
          <p className="px-6 py-12 text-ink/70">No memories here yet.</p>
        ) : (
          <div key={granularity} className={`h-full ${reducedMotion ? "" : "animate-fade-rise"}`}>
            <VList
              ref={listRef}
              style={{ height: "100%" }}
              onScroll={(offset) => {
                const handle = listRef.current;
                const start = handle?.findStartIndex() ?? 0;
                setShowToday(offset > 280 && start > 0);
                const label = groups[start]?.label;
                if (label) setActiveLabel(label);
              }}
            >
              {groups.map((group) => (
                <TimelineSection
                  key={`${granularity}-${group.key}`}
                  group={group}
                  granularity={granularity}
                  onOpen={openFrom}
                  showHeading
                />
              ))}
              <div className="h-8" />
            </VList>
          </div>
        )}

        {showToday && (
          <button
            type="button"
            onClick={() => listRef.current?.scrollToIndex(0, { align: "start", smooth: !reducedMotion })}
            className="absolute bottom-4 right-4 z-20 flex min-h-11 items-center gap-2 rounded-full bg-plum px-4 py-2 text-sm font-medium text-cream shadow-lift transition duration-200 active:scale-95 min-[800px]:bottom-6 min-[800px]:right-6"
            aria-label="Back to today"
          >
            <TodayIcon className="h-4 w-4" />
            Today
          </button>
        )}
      </div>
    </div>
  );
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
