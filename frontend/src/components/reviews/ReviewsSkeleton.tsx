export function ReviewsSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading reviews">
      <div className="h-10 w-full rounded-[10px] bg-neutral-100" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-neutral-200" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 rounded bg-neutral-200" />
              <div className="h-3 w-20 rounded bg-neutral-100" />
            </div>
          </div>
          <div className="h-4 w-2/3 rounded bg-neutral-200" />
          <div className="h-16 w-full rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}
