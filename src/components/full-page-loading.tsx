/** The signed-in shell's busy state, before anything from the catalog may render. */
export function FullPageLoading() {
  return (
    <div aria-busy="true" className="min-h-dvh">
      <span className="sr-only" role="status">
        Loading…
      </span>
    </div>
  );
}
