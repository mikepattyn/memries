import { useCallback, useEffect, useRef, useState } from "react";
import { COMPACT_ROW_OVERSCAN } from "../lib/keepWindow";

export function useVisibleRowRange(rowCount: number, overscan = COMPACT_ROW_OVERSCAN) {
  const [first, setFirst] = useState(0);
  const [last, setLast] = useState(() => Math.max(0, Math.min(rowCount - 1, overscan)));
  const visibleRef = useRef(new Set<number>());
  const observers = useRef(new Map<number, IntersectionObserver>());

  const bindRow = useCallback((index: number) => {
    return (el: HTMLElement | null) => {
      observers.current.get(index)?.disconnect();
      observers.current.delete(index);
      if (!el) return;
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          if (entry.isIntersecting) visibleRef.current.add(index);
          else visibleRef.current.delete(index);
          if (visibleRef.current.size === 0) return;
          const nums = [...visibleRef.current];
          setFirst(Math.min(...nums));
          setLast(Math.max(...nums));
        },
        { threshold: 0 },
      );
      io.observe(el);
      observers.current.set(index, io);
    };
  }, []);

  const maxLast = Math.max(0, rowCount - 1);
  const clampedLast = Math.min(Math.max(last, 0), maxLast);
  if (clampedLast !== last) {
    setLast(clampedLast);
  }

  useEffect(() => {
    const observed = observers.current;
    return () => {
      for (const io of observed.values()) io.disconnect();
      observed.clear();
    };
  }, [rowCount]);

  return { first, last, bindRow };
}
