import type { ReactNode } from "react";
import type { NavTab } from "../models/photo";
import { BottomNavigation, NavButtons, SearchNavButton } from "./BottomNavigation";
import { ThemeToggle } from "./ThemeToggle";
import { TopHeader } from "./TopHeader";

export function AppShell({
  tab,
  onTabChange,
  children,
}: {
  tab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-cream text-plum">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-16 -top-10 h-56 w-56 rounded-full bg-peach/25 blur-3xl" />
        <div className="absolute right-[-4rem] top-24 h-64 w-64 rounded-full bg-mist/70 blur-3xl" />
        <div className="absolute bottom-24 left-10 h-48 w-48 rounded-full bg-sage/50 blur-3xl" />
        <div className="absolute -bottom-10 right-8 h-52 w-52 rounded-full bg-lavender/35 blur-3xl" />
      </div>

      <div className="relative mx-auto flex h-dvh max-w-6xl min-[800px]:h-auto min-[800px]:min-h-dvh min-[800px]:px-4 min-[800px]:py-6">
        <aside className="sticky top-6 hidden h-[calc(100dvh-3rem)] w-52 shrink-0 flex-col justify-between rounded-[1.8rem] bg-surface/45 p-5 shadow-soft backdrop-blur-xl min-[800px]:flex">
          <div>
            <div className="mb-8 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-surface/80 shadow-soft">
                <span className="h-4 w-4 rounded-full bg-gradient-to-br from-peach to-blush" />
              </span>
              <p className="font-display text-2xl font-semibold tracking-tight">Memries</p>
            </div>
            <NavButtons tab={tab} onChange={onTabChange} orientation="vertical" />
          </div>
          <div className="flex flex-col gap-1">
            <SearchNavButton tab={tab} onChange={onTabChange} />
            <ThemeToggle />
          </div>
        </aside>

        <div className="flex h-dvh min-w-0 flex-1 flex-col min-[800px]:ml-5 min-[800px]:h-[calc(100dvh-3rem)] min-[800px]:overflow-hidden min-[800px]:rounded-[1.8rem] min-[800px]:bg-surface/30 min-[800px]:shadow-soft min-[800px]:backdrop-blur-md">
          <TopHeader />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          <BottomNavigation tab={tab} onChange={onTabChange} />
        </div>
      </div>
    </div>
  );
}
