/**
 * Dynamic routes can only be prefetched behind a loading boundary; this one
 * paints the dark shell instantly while the server renders.
 */
export default function StudentLoading() {
  return (
    <div className="animate-pulse space-y-4 px-4 pt-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="mx-auto h-8 w-40 rounded-xl bg-white/[0.06]" />
      <div className="h-14 rounded-2xl bg-white/[0.06]" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl bg-[#17171f]">
          <div className="aspect-video bg-white/[0.06]" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
            <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  );
}
