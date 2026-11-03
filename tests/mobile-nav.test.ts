import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initMobileNav } from '../src/js/modules/mobile-nav';

const MENU_HTML = `
<details class="site-header__menu" data-mobile-nav>
  <summary class="menu-toggle"><span>Menu</span></summary>
  <nav aria-label="Mobile">
    <ul>
      <li><a href="/services/">Services</a></li>
      <li><a href="/about/">About</a></li>
    </ul>
  </nav>
</details>
`;

let cleanup: (() => void) | undefined;

function mount(): { menu: HTMLDetailsElement; summary: HTMLElement; link: HTMLAnchorElement } {
  document.body.innerHTML = MENU_HTML;
  const menu = document.querySelector('details');
  const summary = document.querySelector('summary');
  const link = document.querySelector('a');
  if (!menu || !summary || !link) throw new Error('Fixture incomplete');
  return {
    menu: menu as HTMLDetailsElement,
    summary: summary as HTMLElement,
    link: link as HTMLAnchorElement,
  };
}

/** jsdom does not fire `toggle` itself, so tests dispatch it like a browser. */
function openMenu(menu: HTMLDetailsElement): void {
  menu.open = true;
  menu.dispatchEvent(new Event('toggle'));
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.removeAttribute('data-scroll-locked');
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
});

describe('initMobileNav', () => {
  it('locks page scroll while the panel is open', () => {
    const { menu } = mount();
    cleanup = initMobileNav(menu);

    openMenu(menu);

    expect(menu.dataset.menuOpen).toBe('true');
    expect(document.body.dataset.scrollLocked).toBe('true');
  });

  it('unlocks scroll when the panel closes', () => {
    const { menu } = mount();
    cleanup = initMobileNav(menu);

    openMenu(menu);
    menu.open = false;
    menu.dispatchEvent(new Event('toggle'));

    expect(menu.dataset.menuOpen).toBe('false');
    expect(document.body.dataset.scrollLocked).toBe('false');
  });

  it('closes on Escape and returns focus to the toggle', () => {
    const { menu, summary } = mount();
    cleanup = initMobileNav(menu);

    openMenu(menu);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it('ignores other keys', () => {
    const { menu } = mount();
    cleanup = initMobileNav(menu);

    openMenu(menu);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(menu.open).toBe(true);
  });

  it('does nothing on Escape when already closed', () => {
    const { menu, summary } = mount();
    cleanup = initMobileNav(menu);

    summary.blur();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(menu.open).toBe(false);
    expect(document.activeElement).not.toBe(summary);
  });

  it('closes after following a link', () => {
    const { menu, link } = mount();
    cleanup = initMobileNav(menu);

    openMenu(menu);
    link.addEventListener('click', (event) => event.preventDefault());
    link.click();

    expect(menu.open).toBe(false);
    expect(document.body.dataset.scrollLocked).toBe('false');
  });

  it('closes when the viewport crosses the desktop breakpoint', () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const mediaQueryList = {
      matches: false,
      media: '(min-width: 900px)',
      addEventListener: (_: string, callback: (event: MediaQueryListEvent) => void) => {
        listener = callback;
      },
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;

    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQueryList);

    const { menu } = mount();
    cleanup = initMobileNav(menu, { document });

    openMenu(menu);
    listener?.({ matches: true } as MediaQueryListEvent);

    expect(menu.open).toBe(false);
  });

  it('syncs state if the details starts open', () => {
    const { menu } = mount();
    menu.open = true;
    cleanup = initMobileNav(menu);

    expect(menu.dataset.menuOpen).toBe('true');
    expect(document.body.dataset.scrollLocked).toBe('true');
  });

  it('releases the scroll lock on dispose', () => {
    const { menu } = mount();
    cleanup = initMobileNav(menu);
    openMenu(menu);

    cleanup();
    cleanup = undefined;

    expect(document.body.dataset.scrollLocked).toBe('false');
  });
});
