/**
 * Every page under the app shell is dynamic, and without a loading boundary
 * a dynamic route cannot be prefetched and a click shows nothing until the
 * server has finished. This skeleton paints immediately inside the shell.
 */
export default function AppLoading() {
  return (
    <div
      className="band-inner mx-auto w-full max-w-5xl animate-pulse space-y-6 px-4 py-8 sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 rounded-lg bg-muted" />
      <div className="h-4 w-80 max-w-full rounded bg-muted" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border bg-card">
            <div className="aspect-video bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
