/**
 * Sticky header state + footer year.
 *
 * The header adds a hairline shadow once the page has scrolled, which keeps
 * the wordmark legible over content. Updates are throttled to one per frame.
 */

export function initHeaderScroll(header: HTMLElement, threshold = 8): () => void {
  const view = header.ownerDocument.defaultView ?? window;
  const raf = view.requestAnimationFrame?.bind(view) ?? ((cb: FrameRequestCallback) => view.setTimeout(() => cb(0), 16));
  const cancel = view.cancelAnimationFrame?.bind(view) ?? view.clearTimeout.bind(view);
  let frame = 0;

  const update = (): void => {
    frame = 0;
    header.dataset.scrolled = String(view.scrollY > threshold);
  };

  const onScroll = (): void => {
    if (frame) return;
    frame = raf(update);
  };

  onScroll();
  view.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    view.removeEventListener('scroll', onScroll);
    if (frame) cancel(frame);
  };
}

/** Keep the copyright year current without a build step. */
export function initCopyrightYear(root: ParentNode = document, date = new Date()): () => void {
  const year = String(date.getFullYear());
  root.querySelectorAll<HTMLElement>('[data-current-year]').forEach((node) => {
    node.textContent = year;
  });
  return () => {};
}
