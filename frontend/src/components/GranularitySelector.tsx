import { useRef } from 'react';
import { useSlidingHighlight } from '../hooks/useSlidingHighlight';
import type { Granularity } from '../models/photo';

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'year', label: 'Year' },
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

export function GranularitySelector({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (value: Granularity) => void;
}) {
  const { groupRef, setItemRef, box } = useSlidingHighlight(value);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
        data-granularity-indicator
        data-granularity={value}
        className="pointer-events-none absolute top-1 h-[calc(100%-0.5rem)] rounded-full bg-surface shadow-lift transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
        style={{ left: box.left, width: box.width }}
      />
      {OPTIONS.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonRefs.current[index] = node;
              setItemRef(option.value)(node);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                move(index + 1);
              }
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(index - 1);
              }
              if (event.key === 'Home') {
                event.preventDefault();
                move(0);
              }
              if (event.key === 'End') {
                event.preventDefault();
                move(OPTIONS.length - 1);
              }
            }}
            className={`relative z-10 min-h-11 rounded-full px-2 text-sm font-medium transition-colors duration-200 ${
              checked ? 'text-plum' : 'text-ink/60 hover:text-plum'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
