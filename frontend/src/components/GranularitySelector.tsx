import { useLayoutEffect, useRef, useState } from "react";
import type { Granularity } from "../models/photo";

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

export function GranularitySelector({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (value: Granularity) => void;
}) {
  const selected = OPTIONS.findIndex((option) => option.value === value);
  const groupRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [highlight, setHighlight] = useState({ left: 4, width: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const group = groupRef.current;
      const button = buttonRefs.current[selected];
      if (!group || !button) return;
      const groupBox = group.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      setHighlight({ left: buttonBox.left - groupBox.left, width: buttonBox.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (groupRef.current) observer.observe(groupRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [selected]);

  const move = (nextIndex: number) => {
    const option = OPTIONS[(nextIndex + OPTIONS.length) % OPTIONS.length];
    onChange(option.value);
    buttonRefs.current[(nextIndex + OPTIONS.length) % OPTIONS.length]?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Group memories by"
      className="relative grid grid-cols-4 rounded-full bg-surface/55 p-1 shadow-inner backdrop-blur-md"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-1 h-[calc(100%-0.5rem)] rounded-full bg-surface shadow-lift transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
        style={{ left: highlight.left, width: highlight.width }}
      />
      {OPTIONS.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index + 1);
              }
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index - 1);
              }
              if (event.key === "Home") {
                event.preventDefault();
                move(0);
              }
              if (event.key === "End") {
                event.preventDefault();
                move(OPTIONS.length - 1);
              }
            }}
            className={`relative z-10 min-h-11 rounded-full px-2 text-sm font-medium transition-colors duration-200 ${
              checked ? "text-plum" : "text-ink/60 hover:text-plum"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
