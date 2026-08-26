import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { testPhoto } from '../test/fixtures';
import { Timeline } from './Timeline';

describe('Timeline', () => {
  it('pins the first Timeline Group as the current period', () => {
    render(
      <Timeline
        photos={[testPhoto({ takenAt: '2024-12-12T10:00:00' })]}
        granularity="month"
        onGranularityChange={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByLabelText('Current period')).toHaveTextContent('December 2024');
  });

  it('uses a page heading and names the granularity group', () => {
    render(
      <Timeline photos={[]} granularity="month" onGranularityChange={() => {}} onOpen={() => {}} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Your memries' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Group memories by' })).toBeTruthy();
    expect(screen.getByRole('status')).toHaveTextContent('No memories here yet.');
    expect(screen.getByRole('radio', { name: 'Year' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Month' })).toHaveAttribute('aria-checked', 'true');
  });
});
