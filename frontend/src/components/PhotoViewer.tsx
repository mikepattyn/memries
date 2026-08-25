import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatCompactDate, formatTime } from "../lib/formatDate";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import type { Photo } from "../models/photo";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, HeartIcon } from "./icons";

export function PhotoViewer({
  photos,
  activeId,
  origin,
  onClose,
  onChange,
  onToggleFavorite,
}: {
  photos: Photo[];
  activeId: string;
  origin: DOMRect | null;
  onClose: () => void;
  onChange: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const index = Math.max(0, photos.findIndex((photo) => photo.id === activeId));
  const photo = photos[index];
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const startX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);

  useEffect(() => {
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index > 0) onChange(photos[index - 1].id);
      if (event.key === "ArrowRight" && index < photos.length - 1) onChange(photos[index + 1].id);
      if ((event.key === "f" || event.key === "F") && photo) onToggleFavorite(photo.id);
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos, photo, onClose, onChange, onToggleFavorite]);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || !origin || reducedMotion) return;
    const dest = img.getBoundingClientRect();
    if (dest.width === 0 || dest.height === 0) return;
    const scaleX = origin.width / dest.width;
    const scaleY = origin.height / dest.height;
    const dx = origin.left + origin.width / 2 - (dest.left + dest.width / 2);
    const dy = origin.top + origin.height / 2 - (dest.top + dest.height / 2);
    img.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    img.style.transition = "none";
    const frame = requestAnimationFrame(() => {
      img.style.transition = "transform 280ms ease";
      img.style.transform = "none";
    });
    return () => cancelAnimationFrame(frame);
  }, [photo?.id, origin, reducedMotion]);

  if (!photo) return null;

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= photos.length) return;
    onChange(photos[next].id);
    setDragX(0);
  };

  const canPrev = index > 0;
  const canNext = index < photos.length - 1;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col overflow-x-hidden bg-black/80 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
    >
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 py-3 min-[800px]:px-8 min-[800px]:py-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 text-white">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 min-h-11 min-w-11 place-items-center rounded-full bg-white/10 transition duration-200 hover:bg-white/20"
            aria-label="Close photo"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(photo.id)}
            className="grid h-11 w-11 min-h-11 min-w-11 place-items-center rounded-full bg-white/10 transition duration-200 hover:bg-white/20"
            aria-label={photo.favorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={photo.favorite}
          >
            <HeartIcon className={`h-5 w-5 ${photo.favorite ? "text-peach" : ""}`} filled={photo.favorite} />
          </button>
        </div>

        <p className="mt-3 shrink-0 text-center text-xs uppercase tracking-[0.16em] text-white/60">
          {formatCompactDate(photo.takenAt)} · {formatTime(photo.takenAt)}
        </p>

        <div className="flex min-h-0 min-w-0 flex-1 items-stretch gap-1 py-3 min-[640px]:gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={!canPrev}
            className="grid h-11 w-11 min-h-11 min-w-11 shrink-0 self-center place-items-center rounded-full bg-white/10 text-white disabled:opacity-30"
            aria-label="Previous photo"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div
            className="relative flex min-h-0 min-w-0 flex-1 touch-pan-y items-center justify-center overflow-hidden"
            onPointerDown={(event) => {
              startX.current = event.clientX;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (startX.current === null) return;
              setDragX(event.clientX - startX.current);
            }}
            onPointerUp={() => {
              if (Math.abs(dragX) > 56) go(dragX > 0 ? -1 : 1);
              startX.current = null;
              setDragX(0);
            }}
            onPointerCancel={() => {
              startX.current = null;
              setDragX(0);
            }}
          >
            <img
              ref={imgRef}
              src={photo.imageUrl}
              alt=""
              className="max-h-[min(100%,calc(100dvh-12rem))] max-w-full rounded-2xl object-contain shadow-lift"
              style={{ transform: dragX ? `translateX(${dragX}px)` : undefined }}
            />
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={!canNext}
            className="grid h-11 w-11 min-h-11 min-w-11 shrink-0 self-center place-items-center rounded-full bg-white/10 text-white disabled:opacity-30"
            aria-label="Next photo"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="shrink-0 text-center text-xs text-white/55">
          {index + 1} of {photos.length}
        </p>
      </div>
    </div>
  );
}
