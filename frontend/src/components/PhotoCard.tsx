import { useEffect, useRef, useState } from "react";
import { usePhotoPress } from "../hooks/usePhotoPress";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { useViewportWidth } from "../hooks/useViewportWidth";
import { formatDayLabel, formatTime } from "../lib/formatDate";
import { compactThumbSize, timelineSrc, type PhotoDensity } from "../lib/photoSrc";
import type { Photo } from "../models/photo";
import { FavoriteBadge } from "./FavoriteBadge";

export type { PhotoDensity };

export function PhotoCard({
  photo,
  density,
  showImage = true,
  revealIndex = 0,
  onOpen,
  onActions,
}: {
  photo: Photo;
  density: PhotoDensity;
  showImage?: boolean;
  revealIndex?: number;
  onOpen: (photo: Photo, origin: HTMLElement) => void;
  onActions?: (photo: Photo, origin: HTMLElement) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { ref: revealRef, visible } = useRevealOnScroll<HTMLElement>();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [loaded, setLoaded] = useState(false);
  const viewportWidth = useViewportWidth();
  const compact = density === "thumb" || density === "medium";
  const box = compact ? compactThumbSize(viewportWidth) : undefined;
  const src = timelineSrc(photo, density, viewportWidth);

  const press = usePhotoPress({
    onOpen: () => {
      if (buttonRef.current) onOpen(photo, buttonRef.current);
    },
    onActions: onActions
      ? () => {
          if (buttonRef.current) onActions(photo, buttonRef.current);
        }
      : undefined,
  });

  useEffect(() => {
    setLoaded(false);
  }, [photo.id, src, density, showImage]);

  const radius =
    density === "thumb" ? "rounded-xl" : density === "day" ? "rounded-[1.6rem]" : "rounded-2xl";

  const day = formatDayLabel(photo.takenAt);
  const time = formatTime(photo.takenAt);
  const ariaLabel = photo.favorite
    ? `Open favorited photo, ${day}, ${time}`
    : `Open photo, ${day}, ${time}`;

  return (
    <figure
      ref={revealRef}
      className={`h-full ${reducedMotion ? "" : visible ? "reveal-in" : "reveal"}`}
      style={{ ["--reveal-delay" as string]: `${Math.min(revealIndex, 8) * 40}ms` }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={press.onClick}
        onPointerDown={press.onPointerDown}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onContextMenu={press.onContextMenu}
        onKeyDown={press.onKeyDown}
        className={`group relative block w-full overflow-hidden ${radius} bg-blush/40 shadow-soft transition duration-300 ease-out active:scale-[0.985]`}
        style={{
          aspectRatio: density === "thumb" ? "1 / 1" : `${photo.width} / ${photo.height}`,
          maxHeight: density === "day" ? "min(70vh, 760px)" : density === "featured" ? "min(52vh, 560px)" : undefined,
        }}
        aria-label={ariaLabel}
      >
        {showImage && !loaded && <span className="skeleton absolute inset-0" />}
        {showImage && (
          <img
            src={src}
            alt=""
            width={box ?? photo.width}
            height={box ?? photo.height}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover transition duration-300 ease-out ${
              loaded ? "opacity-100" : "opacity-0"
            } ${reducedMotion ? "" : "group-hover:scale-[1.02]"}`}
            sizes={
              density === "thumb"
                ? "(max-width: 640px) 25vw, (max-width: 800px) 18vw, 140px"
                : density === "day" || density === "featured"
                  ? "(max-width: 800px) 92vw, 720px"
                  : "(max-width: 640px) 48vw, 360px"
            }
            onLoad={() => setLoaded(true)}
          />
        )}
        {photo.favorite && <FavoriteBadge compact={density === "thumb"} />}
      </button>
    </figure>
  );
}
