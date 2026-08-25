import { HeartIcon } from "./icons";

export function FavoriteBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`pointer-events-none absolute z-[1] grid place-items-center rounded-full bg-cream/90 text-plum shadow-soft backdrop-blur-[2px] ${
        compact ? "right-1 top-1 h-5 w-5" : "right-1.5 top-1.5 h-7 w-7"
      }`}
      aria-hidden="true"
    >
      <HeartIcon filled className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
    </span>
  );
}
