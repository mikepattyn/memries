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

  useEffect(() => {
    setLast((current) => Math.min(Math.max(current, 0), Math.max(0, rowCount - 1)));
    return () => {
      for (const io of observers.current.values()) io.disconnect();
      observers.current.clear();
    };
  }, [rowCount]);

  return { first, last, bindRow };
}
