import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import type { Granularity, Photo, TimelineGroup } from "../models/photo";
import { PhotoGrid } from "./PhotoGrid";

export function TimelineSection({
  group,
  granularity,
  onOpen,
  showHeading,
}: {
  group: TimelineGroup;
  granularity: Granularity;
  onOpen: (photo: Photo, origin: HTMLElement) => void;
  showHeading: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { ref, visible } = useRevealOnScroll<HTMLElement>();

  return (
    <section className="px-4 pb-8 min-[640px]:px-6" aria-labelledby={`period-${group.key}`}>
      {showHeading && (
        <header ref={ref} className={`mb-4 pt-2 ${reducedMotion ? "" : visible ? "reveal-in" : "reveal"}`}>
          <h2 id={`period-${group.key}`} className="font-display text-[1.65rem] font-semibold leading-tight tracking-tight text-plum">
            {group.label}
          </h2>
          <p className="mt-0.5 text-sm text-ink/60">{group.sublabel}</p>
        </header>
      )}
      <PhotoGrid photos={group.photos} granularity={granularity} onOpen={onOpen} />
    </section>
  );
}
