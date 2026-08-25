import { useEffect, useRef, useState } from "react";
import type { Album, Photo } from "../models/photo";
import { FoldersIcon, PlusIcon } from "./icons";

export function AlbumsView({
  albums,
  photos,
  onCreate,
  creating,
}: {
  albums: Album[];
  photos: Photo[];
  onCreate: (name: string) => void;
  creating: boolean;
}) {
  const [drafting, setDrafting] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (drafting) inputRef.current?.focus();
  }, [drafting]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    onCreate(trimmed);
    setName("");
    setDrafting(false);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 min-[640px]:px-6">
      <h2 className="font-display text-[2.1rem] font-semibold leading-tight tracking-tight text-plum">Albums</h2>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink/70">
        Gather a handful of days into a set you can return to.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 min-[800px]:grid-cols-3 min-[1280px]:grid-cols-4">
        {drafting ? (
          <form
            className="col-span-2 flex min-h-[11.5rem] flex-col justify-between rounded-[1.4rem] bg-surface/70 p-4 shadow-soft min-[800px]:col-span-1"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="text-sm font-medium text-plum">
              Album name
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Summer, the house, Tuesday…"
                className="mt-2 h-11 w-full rounded-2xl bg-cream px-3 text-sm text-plum outline-none ring-1 ring-plum/10 placeholder:text-ink/40"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!name.trim() || creating}
                className="min-h-11 rounded-full bg-plum px-4 text-sm font-medium text-cream disabled:opacity-40"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrafting(false);
                  setName("");
                }}
                className="min-h-11 rounded-full bg-surface px-4 text-sm font-medium text-ink/70"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setDrafting(true)}
            className="flex min-h-[11.5rem] flex-col items-center justify-center gap-3 rounded-[1.4rem] border border-dashed border-plum/20 bg-surface/40 px-4 text-center transition duration-200 hover:border-peach/70 hover:bg-surface/70 active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-surface text-plum shadow-soft">
              <PlusIcon className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium">New album</span>
          </button>
        )}

        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} photos={photos} />
        ))}
      </div>
    </div>
  );
}

function AlbumCard({ album, photos }: { album: Album; photos: Photo[] }) {
  const cover = photos.find((photo) => album.photoIds.includes(photo.id));
  const count = album.photoIds.length;

  return (
    <article className="overflow-hidden rounded-[1.4rem] bg-surface/70 shadow-soft">
      <div className="relative aspect-[4/3] overflow-hidden bg-blush/50">
        {cover ? (
          <img src={cover.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-peach">
            <FoldersIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="px-3 py-3">
        <h3 className="truncate text-sm font-semibold text-plum">{album.name}</h3>
        <p className="mt-0.5 text-xs text-ink/60">
          {count} {count === 1 ? "photo" : "photos"}
        </p>
      </div>
    </article>
  );
}
