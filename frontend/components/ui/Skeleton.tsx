// Skeletons shaped like the content they stand for, so nothing shifts when the data arrives.
export const Skeleton = ({ className = "" }: { className?: string }) => <div aria-hidden className={`skeleton ${className}`} />;
export const SkeletonText = ({ lines = 2, className = "" }: { lines?: number; className?: string }) => (
  <div className={`space-y-2 ${className}`} aria-hidden>{Array.from({ length: lines }, (_, i) => <div key={i} className="skeleton h-4" style={{ width: i === lines - 1 ? "60%" : "100%" }} />)}</div>
);
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return <div role="status" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4"><div className="skeleton h-12 w-12 flex-none rounded-full" /><div className="flex-1"><SkeletonText lines={lines} /></div></div>;
}
