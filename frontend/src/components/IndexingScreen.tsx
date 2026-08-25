import { useEffect, useMemo, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const STATUS_LINES = [
  "Scanning shoeboxes…",
  "Reading timestamps…",
  "Sorting Sundays from Mondays…",
  "Opening dusty folders…",
  "Lining up the years…",
  "Finding the quiet days…",
];

function shuffle(lines: string[]): string[] {
  const copy = [...lines];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function IndexingScreen({
  leaving,
  onExited,
}: {
  leaving: boolean;
  onExited: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const lines = useMemo(() => shuffle(STATUS_LINES), []);
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion || leaving) return;
    const timer = window.setInterval(() => {
      setLineIndex((current) => (current + 1) % lines.length);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [lines.length, reducedMotion, leaving]);

  useEffect(() => {
    if (!leaving) return;
    if (reducedMotion) {
      onExited();
      return;
    }
    const timer = window.setTimeout(onExited, 420);
    return () => window.clearTimeout(timer);
  }, [leaving, reducedMotion, onExited]);

  return (
    <div
      className={`fixed inset-0 z-40 grid place-items-center bg-cream px-6 text-plum transition-opacity duration-300 ease-out ${
        leaving && !reducedMotion ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-busy={!leaving}
    >
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="relative grid h-20 w-20 place-items-center" aria-hidden>
          <span className="index-spin absolute inset-0 rounded-full border-2 border-plum/10 border-t-peach" />
          <span className="index-pulse h-8 w-8 rounded-full bg-gradient-to-br from-peach to-blush" />
        </div>
        <p className="sr-only">Indexing files on disk</p>
        <p className="mt-8 font-display text-2xl font-semibold tracking-tight">Indexing your files</p>
        <p className="mt-3 min-h-6 text-sm leading-relaxed text-ink/70">{lines[lineIndex]}</p>
      </div>
    </div>
  );
}
