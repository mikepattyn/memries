import type { Granularity } from "./api";

export function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  const from = new Date(Date.UTC(now.getUTCFullYear() - 20, 0, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function bucketLabel(bucket: string, g: Granularity): string {
  if (g === "year") return bucket;
  if (g === "month") {
    const [y, m] = bucket.split("-");
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    return date.toLocaleString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  }
  if (g === "day") {
    const date = new Date(`${bucket}T00:00:00Z`);
    return date.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  }
  // week e.g. "2024-W34"
  return bucket.replace("-W", " · Week ");
}

export function bucketRange(bucket: string, g: Granularity): { from: string; to: string } {
  if (g === "year") {
    const y = Number(bucket);
    return {
      from: new Date(Date.UTC(y, 0, 1)).toISOString(),
      to: new Date(Date.UTC(y + 1, 0, 1)).toISOString(),
    };
  }
  if (g === "month") {
    const [y, m] = bucket.split("-").map(Number);
    return {
      from: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
      to: new Date(Date.UTC(y, m, 1)).toISOString(),
    };
  }
  if (g === "day") {
    const d = new Date(`${bucket}T00:00:00Z`);
    const end = new Date(d);
    end.setUTCDate(end.getUTCDate() + 1);
    return { from: d.toISOString(), to: end.toISOString() };
  }
  // week "YYYY-Www"
  const [yStr, wStr] = bucket.split("-W");
  const y = Number(yStr);
  const w = Number(wStr);
  const start = isoWeekStart(y, w);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { from: start.toISOString(), to: end.toISOString() };
}

function isoWeekStart(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (day - 1));
  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return start;
}
