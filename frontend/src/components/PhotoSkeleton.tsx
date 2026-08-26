export function PhotoSkeleton({ variant = 'grid' }: { variant?: 'grid' | 'day' | 'thumbs' }) {
  if (variant === 'thumbs') {
    return (
      <div
        className="grid grid-cols-4 gap-1.5 min-[640px]:grid-cols-5 min-[800px]:grid-cols-6"
        aria-hidden
      >
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="skeleton aspect-square rounded-xl" />
        ))}
      </div>
    );
  }

  if (variant === 'day') {
    return <div className="skeleton h-64 w-full rounded-3xl min-[640px]:h-80" aria-hidden />;
  }

  return (
    <div className="space-y-3" aria-hidden>
      <div className="skeleton h-44 w-full rounded-3xl min-[640px]:h-56" />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="skeleton aspect-[3/4] rounded-2xl" />
        <div className="skeleton aspect-[3/4] rounded-2xl" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="skeleton aspect-square rounded-2xl" />
        <div className="skeleton aspect-square rounded-2xl" />
        <div className="skeleton aspect-square rounded-2xl" />
      </div>
    </div>
  );
}
