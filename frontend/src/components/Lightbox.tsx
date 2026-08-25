import { useEffect } from "react";
import { originalURL, thumbURL, type Photo } from "../lib/api";

export function Lightbox({
  photo,
  onClose,
  onPrev,
  onNext,
}: {
  photo: Photo | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    if (!photo) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [photo, onClose, onPrev, onNext]);
  if (!photo) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-white text-3xl"
        aria-label="prev"
      >
        ‹
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-white text-3xl"
        aria-label="next"
      >
        ›
      </button>
      <img
        src={originalURL(photo._key)}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[95vw] max-h-[95vh] object-contain"
        style={{ background: `url(${thumbURL(photo._key, 1024)}) center/contain no-repeat` }}
      />
      <div className="absolute bottom-4 left-4 text-neutral-400 text-xs">
        {new Date(photo.taken_at).toLocaleString()}
        {photo.dims ? ` · ${photo.dims.w}×${photo.dims.h}` : null}
      </div>
    </div>
  );
}
