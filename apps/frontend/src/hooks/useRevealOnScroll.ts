import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const visible = reduced || revealed;

  useEffect(() => {
    if (reduced) return;
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  return { ref, visible, reduced };
}
