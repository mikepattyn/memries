import { useEffect, useMemo, useRef } from "react";
import { formatDayLabel } from "../lib/formatDate";
import { photoFacets, searchPhotos } from "../lib/groupPhotos";
import type { Photo, SearchCategory, SearchState } from "../models/photo";
import { FavoriteBadge } from "./FavoriteBadge";
import { SearchIcon } from "./icons";

const CATEGORIES: { id: SearchCategory; label: string }[] = [
  { id: "places", label: "Places" },
  { id: "years", label: "Years" },
  { id: "favorites", label: "Favorites" },
];

export function SearchView({
  photos,
  search,
  onSearchChange,
  onOpen,
  autoFocus,
}: {
  photos: Photo[];
  search: SearchState;
  onSearchChange: (next: SearchState) => void;
  onOpen: (photo: Photo, origin: HTMLElement, list: Photo[]) => void;
  autoFocus: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const facets = useMemo(() => photoFacets(photos), [photos]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const results = useMemo(
    () =>
      searchPhotos(photos, {
        query: search.query,
        places: search.places,
        years: search.years,
        favoritesOnly: search.favoritesOnly,
      }),
    [photos, search],
  );

  const toggleCategory = (id: SearchCategory) => {
    if (id === "favorites") {
      onSearchChange({ ...search, favoritesOnly: !search.favoritesOnly, openCategory: search.openCategory });
      return;
    }
    onSearchChange({
      ...search,
      openCategory: search.openCategory === id ? null : id,
    });
  };

  const facetOptions =
    search.openCategory === "places" ? facets.places : search.openCategory === "years" ? facets.years : [];

  const toggleFacet = (value: string) => {
    if (search.openCategory === "places") {
      onSearchChange({ ...search, places: xor(search.places, value) });
    }
    if (search.openCategory === "years") {
      onSearchChange({ ...search, years: xor(search.years, value) });
    }
  };

  const selectedFacets = search.openCategory === "places" ? search.places : search.years;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3 min-[640px]:px-6">
        <h2 className="font-display text-[2.1rem] font-semibold leading-tight tracking-tight text-plum">Search</h2>
        <label className="mt-4 flex min-h-12 items-center gap-3 rounded-full bg-surface/70 px-4 shadow-soft backdrop-blur-md">
          <SearchIcon className="h-5 w-5 shrink-0 text-ink/45" />
          <span className="sr-only">Search memories</span>
          <input
            ref={inputRef}
            type="search"
            value={search.query}
            onChange={(event) => onSearchChange({ ...search, query: event.target.value })}
            placeholder="Places, years…"
            className="h-12 min-w-0 w-full bg-transparent text-base text-plum outline-none placeholder:text-ink/40"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((category) => {
            const active =
              category.id === "favorites"
                ? search.favoritesOnly
                : search.openCategory === category.id ||
                  (category.id === "places" && search.places.length > 0) ||
                  (category.id === "years" && search.years.length > 0);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.id)}
                aria-pressed={active}
                className={`min-h-11 rounded-full px-4 text-sm font-medium transition duration-200 ${
                  active ? "bg-plum text-cream shadow-lift" : "bg-surface/70 text-ink/70 shadow-soft"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        {facetOptions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {facetOptions.map((option) => {
              const selected = selectedFacets.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleFacet(option)}
                  aria-pressed={selected}
                  className={`min-h-11 rounded-full px-3 text-sm transition duration-200 ${
                    selected ? "bg-peach text-plum" : "bg-surface/50 text-ink/65"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 min-[640px]:px-6">
        {results.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink/60">No memories match that search.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink/55">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
            <div className="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-3 min-[800px]:grid-cols-4">
              {results.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={(event) => onOpen(photo, event.currentTarget, results)}
                  className="relative overflow-hidden rounded-2xl bg-blush/30 shadow-soft transition duration-200 active:scale-[0.985]"
                  aria-label={`Open photo, ${formatDayLabel(photo.takenAt)}${photo.favorite ? ", favorited" : ""}`}
                >
                  <img
                    src={photo.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-square h-full w-full object-cover"
                  />
                  {photo.favorite && <FavoriteBadge compact />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function xor(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
