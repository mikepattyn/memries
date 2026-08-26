import { formatMonthLabel, formatWeekLabel, isoWeekParts, mondayOfIsoWeek } from './formatDate';

export type SmartDateConstraint = {
  years?: string[];
  months?: string[];
  localFrom?: string;
  localTo?: string;
  label: string;
};

export const SEARCH_SUGGESTIONS = [
  { chip: 'Yesterday', query: 'yesterday' },
  { chip: 'Last week', query: 'last week' },
  { chip: 'Last July', query: 'last july' },
  { chip: 'Last winter', query: 'last winter' },
  { chip: 'In the summer', query: 'in the summer' },
  { chip: 'June', query: 'june' },
  { chip: 'Previous spring', query: 'previous spring' },
  { chip: 'Previous fall', query: 'previous fall' },
] as const;

const MONTHS: { name: string; index: number }[] = [
  { name: 'january', index: 1 },
  { name: 'february', index: 2 },
  { name: 'march', index: 3 },
  { name: 'april', index: 4 },
  { name: 'may', index: 5 },
  { name: 'june', index: 6 },
  { name: 'july', index: 7 },
  { name: 'august', index: 8 },
  { name: 'september', index: 9 },
  { name: 'october', index: 10 },
  { name: 'november', index: 11 },
  { name: 'december', index: 12 },
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type Season = 'spring' | 'summer' | 'fall' | 'winter';

const SEASON_MONTHS: Record<Season, [number, number, number]> = {
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  fall: [9, 10, 11],
  winter: [12, 1, 2],
};

export function parseSmartDate(query: string, now: Date): SmartDateConstraint | null {
  const raw = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!raw) return null;

  const isoMonth = raw.match(/^(\d{4})-(\d{2})$/);
  if (isoMonth) {
    const year = Number(isoMonth[1]);
    const month = Number(isoMonth[2]);
    if (month >= 1 && month <= 12) {
      const { from, to } = monthRange(year, month);
      return {
        localFrom: from,
        localTo: to,
        label: formatMonthLabel(`${isoMonth[1]}-${isoMonth[2]}`),
      };
    }
  }

  if (/^\d{4}$/.test(raw)) {
    return { years: [raw], label: raw };
  }

  if (raw === 'yesterday') {
    const today = wallDay(now);
    const yday = addDays(today, -1);
    return {
      localFrom: yday,
      localTo: today,
      label: `Yesterday · ${formatLongDay(yday)}`,
    };
  }

  if (raw === 'last week') {
    const { year, week } = isoWeekParts(`${wallDay(now)}T12:00:00`);
    const monday = mondayOfIsoWeek(year, week);
    const prevMonday = new Date(monday);
    prevMonday.setUTCDate(monday.getUTCDate() - 7);
    const from = utcDay(prevMonday);
    const to = utcDay(monday);
    const prevParts = isoWeekParts(`${from}T12:00:00`);
    const key = `${prevParts.year}-W${pad(prevParts.week)}`;
    return {
      localFrom: from,
      localTo: to,
      label: `Last week · ${formatWeekLabel(key)}`,
    };
  }

  const lastMonth = matchPrefixedMonth(raw, 'last');
  if (lastMonth) {
    const { year, month } = lastNamedMonth(now, lastMonth.index);
    const { from, to } = monthRange(year, month);
    return {
      localFrom: from,
      localTo: to,
      label: `Last ${LONG_MONTHS[month - 1]} · ${formatMonthLabel(`${year}-${pad(month)}`)}`,
    };
  }

  const seasonPhrase = matchSeasonPhrase(raw);
  if (seasonPhrase) {
    const range = lastSeasonRange(now, seasonPhrase.season);
    return {
      localFrom: range.from,
      localTo: range.to,
      label: seasonLabel(seasonPhrase, range),
    };
  }

  const bareMonth = matchBareMonth(raw);
  if (bareMonth) {
    return { months: [pad(bareMonth.index)], label: LONG_MONTHS[bareMonth.index - 1] };
  }

  return null;
}

function matchPrefixedMonth(raw: string, prefix: string): { index: number } | null {
  for (const month of MONTHS) {
    if (raw === `${prefix} ${month.name}`) return month;
  }
  return null;
}

function matchBareMonth(raw: string): { index: number } | null {
  const stripped = raw.replace(/^(a day in|days in|in|during)\s+/, '');
  return MONTHS.find((month) => month.name === stripped) ?? null;
}

function matchSeasonPhrase(
  raw: string,
): { kind: 'last' | 'previous' | 'current'; season: Season } | null {
  const stripped = raw.replace(/^(in the|during the|in|during)\s+/, '');
  const season = parseSeason(stripped.replace(/^(last|previous)\s+/, ''));
  if (!season) return null;
  if (raw.startsWith('previous ')) return { kind: 'previous', season };
  if (raw.startsWith('last ')) return { kind: 'last', season };
  if (
    raw === season ||
    raw === `in the ${season}` ||
    raw === `in ${season}` ||
    raw === `during the ${season}`
  ) {
    return { kind: 'current', season };
  }
  return null;
}

function parseSeason(value: string): Season | null {
  if (value === 'spring') return 'spring';
  if (value === 'summer') return 'summer';
  if (value === 'fall' || value === 'autumn') return 'fall';
  if (value === 'winter') return 'winter';
  return null;
}

function lastNamedMonth(now: Date, month: number): { year: number; month: number } {
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (currentMonth > month) return { year, month };
  return { year: year - 1, month };
}

function lastSeasonRange(
  now: Date,
  season: Season,
): { from: string; to: string; startYear: number } {
  const year = now.getFullYear();
  const candidate = seasonRangeForYear(season, year);
  if (compareDay(wallDay(now), candidate.from) >= 0) return candidate;
  return seasonRangeForYear(season, year - 1);
}

function seasonRangeForYear(
  season: Season,
  year: number,
): { from: string; to: string; startYear: number } {
  if (season === 'winter') {
    return { from: `${year - 1}-12-01`, to: `${year}-03-01`, startYear: year - 1 };
  }
  const [startMonth] = SEASON_MONTHS[season];
  const endMonth = startMonth + 3;
  const endYear = endMonth > 12 ? year + 1 : year;
  const end = endMonth > 12 ? endMonth - 12 : endMonth;
  return {
    from: `${year}-${pad(startMonth)}-01`,
    to: `${endYear}-${pad(end)}-01`,
    startYear: year,
  };
}

function seasonLabel(
  phrase: { kind: 'last' | 'previous' | 'current'; season: Season },
  range: { from: string; to: string; startYear: number },
): string {
  const startMonth = Number(range.from.slice(5, 7));
  const endMonth = addMonths(range.from, 2);
  const endYear = Number(endMonth.slice(0, 4));
  const shortStart = SHORT_MONTHS[startMonth - 1];
  const shortEnd = SHORT_MONTHS[Number(endMonth.slice(5, 7)) - 1];
  const seasonName = phrase.season === 'fall' ? 'fall' : phrase.season;
  if (phrase.kind === 'current') {
    return `${capitalize(seasonName)} ${range.startYear} · ${shortStart}–${shortEnd}`;
  }
  const prefix = phrase.kind === 'last' ? 'Last' : 'Previous';
  if (range.startYear !== endYear) {
    return `${prefix} ${seasonName} · ${shortStart} ${range.startYear}–${shortEnd} ${endYear}`;
  }
  return `${prefix} ${seasonName} · ${shortStart}–${shortEnd} ${range.startYear}`;
}

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${pad(month)}-01`;
  return { from, to: addMonths(from, 1) };
}

function wallDay(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function utcDay(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + delta));
  return utcDay(next);
}

function addMonths(day: string, delta: number): string {
  const [y, m] = day.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1 + delta, 1));
  return utcDay(next);
}

function compareDay(a: string, b: string): number {
  return a.localeCompare(b);
}

function formatLongDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${LONG_MONTHS[m - 1]} ${y}`;
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
