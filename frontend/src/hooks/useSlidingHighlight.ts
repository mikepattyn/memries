import { useLayoutEffect, useRef, useState } from "react";

export function useSlidingHighlight(selectedKey: string) {
  const groupRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Record<string, HTMLElement | null>>({});
  const [box, setBox] = useState({ left: 4, top: 4, width: 0, height: 0 });

  const setItemRef = (key: string) => (node: HTMLElement | null) => {
    itemsRef.current[key] = node;
  };

  useLayoutEffect(() => {
    const measure = () => {
      const group = groupRef.current;
      const item = itemsRef.current[selectedKey];
      if (!group || !item) return;
      const groupBox = group.getBoundingClientRect();
      const itemBox = item.getBoundingClientRect();
      setBox({
        left: itemBox.left - groupBox.left,
        top: itemBox.top - groupBox.top,
        width: itemBox.width,
        height: itemBox.height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (groupRef.current) observer.observe(groupRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [selectedKey]);

  return { groupRef, setItemRef, box };
}
