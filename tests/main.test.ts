import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTACT_FORM_HTML } from './helpers/contact-form-fixture';

const PAGE_HTML = `
  <header class="site-header" data-site-header></header>
  <details data-mobile-nav>
    <summary>Menu</summary>
    <nav aria-label="Mobile"><a href="/about/">About</a></nav>
  </details>
  ${CONTACT_FORM_HTML}
  <p>&copy; <span data-current-year>1999</span></p>
`;

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
  // Resolve animation frames immediately so the header state is observable.
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('main entry point', () => {
  it('initialises every feature it finds on the page', async () => {
    document.body.innerHTML = PAGE_HTML;

    await import('../src/js/main');

    const header = document.querySelector<HTMLElement>('[data-site-header]');
    expect(header?.dataset.scrolled).toBe('false');

    const menu = document.querySelector<HTMLDetailsElement>('[data-mobile-nav]');
    menu!.open = true;
    menu!.dispatchEvent(new Event('toggle'));
    expect(document.body.dataset.scrollLocked).toBe('true');

    const form = document.querySelector<HTMLFormElement>('form');
    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(document.querySelector('[data-error-for="name"]')?.hasAttribute('hidden')).toBe(false);

    expect(document.querySelector('[data-current-year]')?.textContent).toBe(
      String(new Date().getFullYear()),
    );
  });

  it('does nothing on a page without those elements', async () => {
    document.body.innerHTML = '<main id="main"><h1>Plain</h1></main>';

    await expect(import('../src/js/main')).resolves.toBeDefined();
    expect(document.querySelector('[data-site-header]')).toBeNull();
  });
});
