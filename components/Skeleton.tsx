export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="life-card p-4">
      <div className="skeleton mb-4 h-7 w-2/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton mb-2 h-4" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}</div>;
}
