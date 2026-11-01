/** Scrolls to a browse row and moves focus to its heading (FR-010). Returns false if it isn't on the page. */
export function jumpToRow(rowId: string): boolean {
  const heading = document.getElementById(rowId);
  if (!heading) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${rowId}`);
  return true;
}
