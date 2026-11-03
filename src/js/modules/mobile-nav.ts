/**
 * Mobile navigation.
 *
 * The menu is a native `<details>` element, so it opens and closes without
 * JavaScript. This module only adds the conveniences a native disclosure
 * cannot provide:
 *
 *   - Escape closes the panel and returns focus to the toggle.
 *   - Following a link closes the panel (harmless, but keeps state tidy).
 *   - The page behind the panel stops scrolling while it is open.
 *   - Resizing up to the desktop layout closes it.
 */

const DESKTOP_QUERY = '(min-width: 900px)';

export interface MobileNavOptions {
  document?: Document;
  mediaQuery?: string;
}

export function initMobileNav(
  menu: HTMLDetailsElement,
  options: MobileNavOptions = {},
): () => void {
  const doc = options.document ?? menu.ownerDocument;
  const view = doc.defaultView;
  const desktop =
    typeof view?.matchMedia === 'function'
      ? view.matchMedia(options.mediaQuery ?? DESKTOP_QUERY)
      : null;
  const summary = menu.querySelector<HTMLElement>('summary');

  function syncExpanded(open: boolean): void {
    menu.dataset.menuOpen = String(open);
    doc.body.dataset.scrollLocked = String(open);
  }

  function close(returnFocus = false): void {
    if (!menu.open) return;
    menu.open = false;
    syncExpanded(false);
    if (returnFocus) summary?.focus();
  }

  function handleToggle(): void {
    syncExpanded(menu.open);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !menu.open) return;
    event.preventDefault();
    close(true);
  }

  function handleLinkClick(): void {
    close();
  }

  function handleBreakpointChange(event: MediaQueryListEvent): void {
    if (event.matches) close();
  }

  const links = Array.from(menu.querySelectorAll<HTMLAnchorElement>('a[href]'));

  menu.addEventListener('toggle', handleToggle);
  doc.addEventListener('keydown', handleKeydown);
  links.forEach((link) => link.addEventListener('click', handleLinkClick));
  desktop?.addEventListener('change', handleBreakpointChange);

  // Reset any state left over from a restored scroll position.
  syncExpanded(menu.open);

  return () => {
    menu.removeEventListener('toggle', handleToggle);
    doc.removeEventListener('keydown', handleKeydown);
    links.forEach((link) => link.removeEventListener('click', handleLinkClick));
    desktop?.removeEventListener('change', handleBreakpointChange);
    doc.body.dataset.scrollLocked = 'false';
  };
}
