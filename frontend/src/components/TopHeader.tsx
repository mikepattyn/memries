import { ThemeToggle } from "./ThemeToggle";

export function TopHeader() {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 min-[640px]:px-6 min-[800px]:hidden">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-surface/70 shadow-soft backdrop-blur-md" aria-hidden>
          <span className="h-4 w-4 rounded-full bg-gradient-to-br from-peach to-blush" />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-plum">Memries</h1>
      </div>
      <ThemeToggle compact />
    </header>
  );
}
