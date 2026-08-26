import { describe, expect, it } from 'vitest';
import { formatMonthLabel, formatWeekLabel } from './formatDate';
import { groupKey } from './groupPhotos';

describe('formatMonthLabel', () => {
  it('formats year-month keys for timeline month groups', () => {
    expect(formatMonthLabel('2026-08')).toBe('August 2026');
    expect(formatMonthLabel('2026-07')).toBe('July 2026');
    expect(formatMonthLabel('2025-12')).toBe('December 2025');
  });
});

describe('formatWeekLabel', () => {
  it('formats a week wholly inside one month', () => {
    const key = groupKey('2026-08-24T10:00:00', 'week');
    expect(formatWeekLabel(key)).toBe('24–30 Aug 2026');
  });

  it('formats a week spanning two months', () => {
    const key = groupKey('2026-08-31T10:00:00', 'week');
    expect(formatWeekLabel(key)).toBe('31 Aug – 6 Sep 2026');
  });
});
