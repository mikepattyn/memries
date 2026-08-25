import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import type { Photo } from "../models/photo";
import { FavoriteBadge } from "./FavoriteBadge";

export type PhotoDensity = "thumb" | "medium" | "featured" | "day";

export function PhotoCard({
  photo,
  density,
  onOpen,
}: {
  photo: Photo;
  density: PhotoDensity;
  onOpen: (photo: Photo, origin: HTMLElement) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { ref: revealRef, visible } = useRevealOnScroll<HTMLElement>();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [loaded, setLoaded] = useState(false);
  const src = density === "featured" || density === "day" ? photo.imageUrl : photo.thumbnailUrl;

  useEffect(() => {
    setLoaded(false);
  }, [photo.id, photo.imageUrl, photo.thumbnailUrl, density]);

  const radius =
    density === "thumb" ? "rounded-xl" : density === "day" ? "rounded-[1.6rem]" : "rounded-2xl";

  return (
    <figure ref={revealRef} className={`h-full ${reducedMotion ? "" : visible ? "reveal-in" : "reveal"}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (buttonRef.current) onOpen(photo, buttonRef.current);
        }}
        className={`group relative block w-full overflow-hidden ${radius} bg-blush/40 shadow-soft transition duration-300 ease-out active:scale-[0.985]`}
        style={{
          aspectRatio: density === "thumb" ? "1 / 1" : `${photo.width} / ${photo.height}`,
          maxHeight: density === "day" ? "min(70vh, 760px)" : density === "featured" ? "min(52vh, 560px)" : undefined,
        }}
        aria-label={photo.favorite ? "Open favorited photo" : "Open photo"}
      >
        {!loaded && <span className="skeleton absolute inset-0" />}
        <img
          src={src}
          alt=""
          width={photo.width}
          height={photo.height}
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
        {photo.favorite && <FavoriteBadge compact={density === "thumb"} />}
      </button>
    </figure>
  );
}
