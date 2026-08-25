import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { VList } from "virtua";
import {
  fetchPhotos,
  fetchTimeline,
  thumbURL,
  type Granularity,
  type Photo,
} from "../lib/api";
import { bucketLabel, bucketRange, defaultRange } from "../lib/dates";
import { GranularityToggle } from "./GranularityToggle";
import { Lightbox } from "./Lightbox";

const COLS = 6;
const GAP = 4;

type Row =
  | { kind: "header"; bucket: string; label: string; count: number }
  | { kind: "photos"; bucket: string; photos: Photo[] };

const GRANULARITY_KEY = "memries.granularity";
const VALID_GRANULARITIES: Granularity[] = ["year", "month", "week", "day"];

function loadGranularity(): Granularity {
  try {
    const v = localStorage.getItem(GRANULARITY_KEY);
    if (v && (VALID_GRANULARITIES as string[]).includes(v)) return v as Granularity;
  } catch {}
  return "month";
}

export function Timeline() {
  const [granularity, setGranularity] = useState<Granularity>(loadGranularity);
  useEffect(() => {
    try { localStorage.setItem(GRANULARITY_KEY, granularity); } catch {}
  }, [granularity]);
  const range = useMemo(defaultRange, []);

  const timelineQ = useQuery({
    queryKey: ["timeline", granularity, range.from, range.to],
    queryFn: () => fetchTimeline(granularity, range.from, range.to),
  });

  const buckets = timelineQ.data?.buckets ?? [];

  const photoQueries = useQueries({
    queries: buckets.map((b) => {
      const r = bucketRange(b.bucket, granularity);
      return {
        queryKey: ["photos", r.from, r.to],
        queryFn: () => fetchPhotos(r.from, r.to),
        staleTime: 5 * 60_000,
      };
    }),
  });

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    buckets.forEach((b, i) => {
      out.push({
        kind: "header",
        bucket: b.bucket,
        label: bucketLabel(b.bucket, granularity),
        count: b.count,
      });
      const photos = photoQueries[i]?.data?.photos ?? [];
      for (let j = 0; j < photos.length; j += COLS) {
        out.push({
          kind: "photos",
          bucket: b.bucket,
          photos: photos.slice(j, j + COLS),
        });
      }
    });
    return out;
  }, [buckets, photoQueries, granularity]);

  const flatPhotos: Photo[] = useMemo(
    () => rows.flatMap((r) => (r.kind === "photos" ? r.photos : [])),
    [rows],
  );
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const active = activeIdx !== null ? flatPhotos[activeIdx] ?? null : null;

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h1 className="text-lg font-semibold tracking-tight">Memries</h1>
        <GranularityToggle value={granularity} onChange={setGranularity} />
      </header>
      <div className="flex-1 min-h-0">
        {timelineQ.isLoading ? (
          <div className="p-6 text-neutral-400">Loading…</div>
        ) : timelineQ.isError ? (
          <div className="p-6 text-red-400">Error: {(timelineQ.error as Error).message}</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-neutral-400">No photos yet. Run the indexer.</div>
        ) : (
          <VList style={{ height: "100%" }}>
            {rows.map((row, i) =>
              row.kind === "header" ? (
                <div
                  key={`h-${i}`}
                  className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur px-4 py-2 text-sm text-neutral-300 border-b border-neutral-900"
                >
                  <span className="font-medium">{row.label}</span>
                  <span className="ml-2 text-neutral-500">{row.count}</span>
                </div>
              ) : (
                <PhotoRow
                  key={`p-${i}`}
                  row={row}
                  onClick={(p) => {
                    const idx = flatPhotos.findIndex((fp) => fp._key === p._key);
                    setActiveIdx(idx >= 0 ? idx : null);
                  }}
                />
              ),
            )}
          </VList>
        )}
      </div>
      <Lightbox
        photo={active}
        onClose={() => setActiveIdx(null)}
        onPrev={() => setActiveIdx((i) => (i === null ? null : Math.max(0, i - 1)))}
        onNext={() => setActiveIdx((i) => (i === null ? null : Math.min(flatPhotos.length - 1, i + 1)))}
      />
    </div>
  );
}

function PhotoRow({ row, onClick }: { row: Extract<Row, { kind: "photos" }>; onClick: (p: Photo) => void }) {
  return (
    <div
      className="grid px-4"
      style={{
        gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
        gap: GAP,
        paddingTop: GAP,
      }}
    >
      {row.photos.map((p) => (
        <button
          key={p._key}
          onClick={() => onClick(p)}
          className="aspect-square overflow-hidden bg-neutral-900 rounded-sm focus:outline focus:outline-2 focus:outline-blue-500"
        >
          <img
            src={thumbURL(p._key, 512)}
            srcSet={`${thumbURL(p._key, 256)} 256w, ${thumbURL(p._key, 512)} 512w, ${thumbURL(p._key, 1024)} 1024w`}
            sizes="(max-width: 640px) 33vw, (max-width: 1280px) 17vw, 12vw"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}
