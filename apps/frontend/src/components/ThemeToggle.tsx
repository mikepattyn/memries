import { useTheme } from '../hooks/useTheme';
import { MoonIcon, SunIcon } from './icons';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  const Icon = theme === 'dark' ? SunIcon : MoonIcon;

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="grid h-11 w-11 place-items-center rounded-full bg-surface/70 text-plum shadow-soft backdrop-blur-md transition duration-200 hover:rotate-12 active:scale-95"
        aria-label={label}
        data-theme-toggle
      >
        <Icon className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-ink transition duration-200 hover:bg-surface/70 hover:text-plum hover:rotate-0 active:scale-[0.98]"
      aria-label={label}
      data-theme-toggle
    >
      <Icon className="h-5 w-5" />
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
