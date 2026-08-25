import type { NavTab } from "../models/photo";
import { AlbumIcon, FoldersIcon, HeartIcon, SearchIcon } from "./icons";

type NavItem = { id: NavTab; label: string; icon: typeof AlbumIcon };

const PRIMARY_ITEMS: NavItem[] = [
  { id: "memories", label: "Memories", icon: AlbumIcon },
  { id: "favorites", label: "Favorites", icon: HeartIcon },
  { id: "albums", label: "Albums", icon: FoldersIcon },
];

const SEARCH_ITEM: NavItem = { id: "search", label: "Search", icon: SearchIcon };

const MOBILE_ITEMS: NavItem[] = [...PRIMARY_ITEMS, SEARCH_ITEM];

function NavButton({
  item,
  selected,
  onChange,
  layout,
}: {
  item: NavItem;
  selected: boolean;
  onChange: (tab: NavTab) => void;
  layout: "vertical" | "horizontal";
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onChange(item.id)}
      aria-current={selected ? "page" : undefined}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl px-2 py-2 text-sm font-medium transition duration-200 active:scale-[0.98] ${
        layout === "vertical" ? "w-full justify-start px-3" : "flex-col gap-0.5 text-[0.7rem] min-[640px]:text-xs"
      } ${selected ? "bg-surface/80 text-plum shadow-soft" : "text-ink/55 hover:text-plum"}`}
    >
      {item.id === "favorites" ? (
        <HeartIcon className="h-5 w-5" filled={selected} />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      <span className="max-w-full truncate">{item.label}</span>
    </button>
  );
}

export function NavButtons({
  tab,
  onChange,
  orientation,
}: {
  tab: NavTab;
  onChange: (tab: NavTab) => void;
  orientation: "horizontal" | "vertical";
}) {
  if (orientation === "vertical") {
    return (
      <div role="navigation" aria-label="Main" className="flex flex-col gap-1">
        {PRIMARY_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            selected={tab === item.id}
            onChange={onChange}
            layout="vertical"
          />
        ))}
      </div>
    );
  }

  return (
    <div role="navigation" aria-label="Main" className="nav-bar-mobile">
      {MOBILE_ITEMS.map((item) => (
        <NavButton
          key={item.id}
          item={item}
          selected={tab === item.id}
          onChange={onChange}
          layout="horizontal"
        />
      ))}
    </div>
  );
}

export function SearchNavButton({
  tab,
  onChange,
}: {
  tab: NavTab;
  onChange: (tab: NavTab) => void;
}) {
  return (
    <NavButton item={SEARCH_ITEM} selected={tab === SEARCH_ITEM.id} onChange={onChange} layout="vertical" />
  );
}

export function BottomNavigation({ tab, onChange }: { tab: NavTab; onChange: (tab: NavTab) => void }) {
  return (
    <nav className="border-t border-plum/10 bg-cream/80 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl min-[640px]:px-3 min-[800px]:hidden">
      <NavButtons tab={tab} onChange={onChange} orientation="horizontal" />
    </nav>
  );
}
