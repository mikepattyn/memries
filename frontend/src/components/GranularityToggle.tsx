import type { Granularity } from "../lib/api";

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

export function GranularityToggle({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (g: Granularity) => void;
}) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-neutral-700">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={
            "px-3 py-1.5 text-sm transition-colors " +
            (value === o.value
              ? "bg-neutral-100 text-neutral-900"
              : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
