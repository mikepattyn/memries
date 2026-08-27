import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '../hooks/useTheme';
import { AppShell } from './AppShell';

function renderShell() {
  return render(
    <ThemeProvider>
      <AppShell tab="memories" onTabChange={() => {}}>
        <h1>Your memries</h1>
      </AppShell>
    </ThemeProvider>,
  );
}

describe('AppShell', () => {
  it('exposes a main landmark and a skip link', () => {
    renderShell();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { level: 1, name: 'Your memries' }),
    );
  });

  it('keeps the brand out of the heading outline', () => {
    renderShell();
    expect(screen.getAllByText('Memries').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Memries' })).toBeNull();
  });

  it('names the primary navigation', () => {
    renderShell();
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0);
  });
});
