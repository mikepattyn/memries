import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CurrentPeriod } from './CurrentPeriod';

describe('CurrentPeriod', () => {
  it('names the pinned Timeline Group for assistive tech', () => {
    render(
      <CurrentPeriod
        label="December 2024"
        scrolling={false}
        direction="older"
        reducedMotion={false}
      />,
    );
    const period = screen.getByLabelText('Current period');
    expect(period).toHaveTextContent('December 2024');
    expect(period).toHaveAttribute('data-period-motion', 'idle');
    expect(period.closest('[data-period-scrolling]')).toHaveAttribute(
      'data-period-scrolling',
      'false',
    );
  });

  it('grows while the timeline is scrolling', () => {
    render(
      <CurrentPeriod label="December 2024" scrolling direction="older" reducedMotion={false} />,
    );
    const period = screen.getByLabelText('Current period');
    expect(period).toHaveAttribute('data-period-motion', 'scroll');
    expect(period.closest('[data-period-scrolling]')).toHaveAttribute(
      'data-period-scrolling',
      'true',
    );
  });

  it('slides the outgoing Timeline Group out as the next one arrives', () => {
    const { rerender } = render(
      <CurrentPeriod label="December 2024" scrolling direction="older" reducedMotion={false} />,
    );
    rerender(
      <CurrentPeriod label="November 2024" scrolling direction="older" reducedMotion={false} />,
    );
    expect(screen.getByLabelText('Current period')).toHaveTextContent('November 2024');
    expect(screen.getByLabelText('Current period')).toHaveAttribute(
      'data-period-motion',
      'slide-older',
    );
    expect(screen.getByText('December 2024')).toHaveAttribute('aria-hidden');
  });

  it('stays still when motion is reduced', () => {
    render(<CurrentPeriod label="December 2024" scrolling direction="older" reducedMotion />);
    const period = screen.getByLabelText('Current period');
    expect(period).toHaveAttribute('data-period-motion', 'none');
    expect(period.closest('[data-period-scrolling]')).toHaveAttribute(
      'data-period-scrolling',
      'false',
    );
  });

  it('snaps to the next Timeline Group when motion is reduced', () => {
    const { rerender } = render(
      <CurrentPeriod label="December 2024" scrolling direction="older" reducedMotion />,
    );
    rerender(<CurrentPeriod label="November 2024" scrolling direction="older" reducedMotion />);
    expect(screen.getByLabelText('Current period')).toHaveTextContent('November 2024');
    expect(screen.getByLabelText('Current period')).toHaveAttribute('data-period-motion', 'none');
    expect(screen.queryByText('December 2024')).not.toBeInTheDocument();
  });
});
