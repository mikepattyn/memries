import { useSlidingHighlight } from '../hooks/useSlidingHighlight';
import type { NavTab } from '../models/photo';
import { AlbumIcon, FoldersIcon, HeartIcon, SearchIcon } from './icons';

type NavItem = { id: NavTab; label: string; icon: typeof AlbumIcon };

const PRIMARY_ITEMS: NavItem[] = [
  { id: 'memories', label: 'Memories', icon: AlbumIcon },
  { id: 'favorites', label: 'Favorites', icon: HeartIcon },
  { id: 'albums', label: 'Albums', icon: FoldersIcon },
];

const SEARCH_ITEM: NavItem = { id: 'search', label: 'Search', icon: SearchIcon };

const MOBILE_ITEMS: NavItem[] = [...PRIMARY_ITEMS, SEARCH_ITEM];

function NavButton({
  item,
  selected,
  onChange,
  layout,
  buttonRef,
  filled,
}: {
  item: NavItem;
  selected: boolean;
  onChange: (tab: NavTab) => void;
  layout: 'vertical' | 'horizontal';
  buttonRef?: (node: HTMLButtonElement | null) => void;
  filled?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => onChange(item.id)}
      aria-current={selected ? 'page' : undefined}
      className={`relative z-10 flex min-h-11 items-center justify-center gap-2 rounded-2xl px-2 py-2 text-sm font-medium transition duration-200 active:scale-[0.98] ${
        layout === 'vertical'
          ? 'w-full justify-between px-3'
          : 'flex-col gap-0.5 text-[0.7rem] min-[640px]:text-xs'
      } ${
        selected && filled
          ? 'bg-surface/80 text-plum shadow-soft'
          : selected
            ? 'text-plum'
            : 'text-ink hover:text-plum'
      }`}
    >
      {item.id === 'favorites' ? (
        <HeartIcon className="h-5 w-5" filled={selected} />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      <span className="max-w-full truncate">{item.label}</span>
    </button>
  );
}

function SlidingIndicator({
  box,
}: {
  box: { left: number; top: number; width: number; height: number };
}) {
  return (
    <div
      aria-hidden
      data-nav-indicator
      className="pointer-events-none absolute rounded-2xl bg-surface/80 shadow-soft transition-[left,top,width,height] duration-300 ease-out motion-reduce:transition-none"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    />
  );
}

export function NavButtons({
  tab,
  onChange,
  orientation,
}: {
  tab: NavTab;
  onChange: (tab: NavTab) => void;
  orientation: 'horizontal' | 'vertical';
}) {
  const items = orientation === 'vertical' ? PRIMARY_ITEMS : MOBILE_ITEMS;
  const selected = items.some((item) => item.id === tab) ? tab : items[0].id;
  const { groupRef, setItemRef, box } = useSlidingHighlight(selected);

  if (orientation === 'vertical') {
    return (
      <div ref={groupRef} className="relative flex flex-col gap-1">
        <SlidingIndicator box={box} />
        {PRIMARY_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            selected={tab === item.id}
            onChange={onChange}
            layout="vertical"
            buttonRef={setItemRef(item.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div ref={groupRef} className="relative">
      <SlidingIndicator box={box} />
      <div className="nav-bar-mobile">
        {MOBILE_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            selected={tab === item.id}
            onChange={onChange}
            layout="horizontal"
            buttonRef={setItemRef(item.id)}
          />
        ))}
      </div>
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
    <NavButton
      item={SEARCH_ITEM}
      selected={tab === SEARCH_ITEM.id}
      onChange={onChange}
      layout="vertical"
      filled
    />
  );
}

export function BottomNavigation({
  tab,
  onChange,
}: {
  tab: NavTab;
  onChange: (tab: NavTab) => void;
}) {
  return (
    <nav
      data-nav-layout="bottom"
      aria-label="Main"
      className="border-t border-plum/10 bg-cream/80 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl min-[800px]:hidden"
    >
      <NavButtons tab={tab} onChange={onChange} orientation="horizontal" />
    </nav>
  );
}
