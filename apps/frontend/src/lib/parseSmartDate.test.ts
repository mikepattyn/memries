import { describe, expect, it } from 'vitest';
import { parseSmartDate } from './parseSmartDate';

const NOW = new Date('2026-08-26T12:00:00.000Z');

describe('parseSmartDate', () => {
  it.each([
    [
      'yesterday',
      {
        localFrom: '2026-08-25',
        localTo: '2026-08-26',
        label: 'Yesterday · 25 August 2026',
      },
    ],
    [
      'last week',
      {
        localFrom: '2026-08-17',
        localTo: '2026-08-24',
        label: 'Last week · 17–23 Aug 2026',
      },
    ],
    [
      'last july',
      {
        localFrom: '2026-07-01',
        localTo: '2026-08-01',
        label: 'Last July · July 2026',
      },
    ],
    [
      'a day in june',
      {
        months: ['06'],
        label: 'June',
      },
    ],
    [
      'june',
      {
        months: ['06'],
        label: 'June',
      },
    ],
    [
      'in the summer',
      {
        localFrom: '2026-06-01',
        localTo: '2026-09-01',
        label: 'Summer 2026 · Jun–Aug',
      },
    ],
    [
      'last winter',
      {
        localFrom: '2025-12-01',
        localTo: '2026-03-01',
        label: 'Last winter · Dec 2025–Feb 2026',
      },
    ],
    [
      'previous spring',
      {
        localFrom: '2026-03-01',
        localTo: '2026-06-01',
        label: 'Previous spring · Mar–May 2026',
      },
    ],
    [
      'previous fall',
      {
        localFrom: '2025-09-01',
        localTo: '2025-12-01',
        label: 'Previous fall · Sep–Nov 2025',
      },
    ],
    [
      '2025',
      {
        years: ['2025'],
        label: '2025',
      },
    ],
    [
      '2025-12',
      {
        localFrom: '2025-12-01',
        localTo: '2026-01-01',
        label: 'December 2025',
      },
    ],
  ] as const)('parses %s', (query, expected) => {
    expect(parseSmartDate(query, NOW)).toEqual(expected);
  });

  it('returns null for an unknown phrase', () => {
    expect(parseSmartDate('next christmas', NOW)).toBeNull();
  });

  it('returns null for an empty query', () => {
    expect(parseSmartDate('  ', NOW)).toBeNull();
  });
});
