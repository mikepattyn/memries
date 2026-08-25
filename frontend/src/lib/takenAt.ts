/**
 * Capture-time helpers. Prefer EXIF wall-clock strings and never run them
 * through `Date` / the machine timezone (that shifts e.g. 17:34 into 15:34Z).
 *
 * Tag order used by the Vite library plugin:
 *   1. DateTimeOriginal
 *   2. CreateDate
 *   3. DateTimeDigitized
 *   4. DateCreated (XMP)
 *   5. PNG tEXt "Creation Time"
 *   6. file mtime (UTC components) — last resort only
 */
export const TAKEN_AT_TAG_ORDER = [
  "DateTimeOriginal",
  "CreateDate",
  "DateTimeDigitized",
  "DateCreated",
  "Creation Time",
] as const;

const EXIF_CLOCK = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;
const RFC_CLOCK =
  /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\b/i;

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** `2024:08:25 18:30:01` → `2024-08-25T18:30:01` (subseconds dropped). */
export function wallClockFromExifValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  const iso = text.match(EXIF_CLOCK);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}:${iso[6]}`;
  }
  const rfc = text.match(RFC_CLOCK);
  if (!rfc) return null;
  const month = MONTHS[rfc[2].slice(0, 3).toLowerCase()];
  if (!month) return null;
  return `${rfc[3]}-${month}-${rfc[1].padStart(2, "0")}T${rfc[4]}:${rfc[5]}:${rfc[6]}`;
}

export function takenAtFromUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}
