import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCopyrightYear, initHeaderScroll } from '../src/js/modules/header';

let cleanup: (() => void) | undefined;
let frames: FrameRequestCallback[] = [];

/** Run every queued animation frame, like a browser's next paint. */
function flushFrames(): void {
  const queued = frames;
  frames = [];
  queued.forEach((callback) => callback(0));
}

beforeEach(() => {
  document.body.innerHTML = '<header class="site-header" data-site-header></header>';
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

function setScrollY(value: number): void {
  Object.defineProperty(window, 'scrollY', { value, configurable: true });
}

describe('initHeaderScroll', () => {
  it('starts unscrolled at the top of the page', () => {
    const header = document.querySelector<HTMLElement>('header');
    if (!header) throw new Error('missing header');

    cleanup = initHeaderScroll(header);
    flushFrames();

    expect(header.dataset.scrolled).toBe('false');
  });

  it('marks the header as scrolled past the threshold', () => {
    const header = document.querySelector<HTMLElement>('header');
    if (!header) throw new Error('missing header');
    cleanup = initHeaderScroll(header);

    flushFrames();
    setScrollY(120);
    window.dispatchEvent(new Event('scroll'));
    flushFrames();

    expect(header.dataset.scrolled).toBe('true');
  });

  it('returns to the unscrolled state near the top', () => {
    const header = document.querySelector<HTMLElement>('header');
    if (!header) throw new Error('missing header');
    cleanup = initHeaderScroll(header);

    flushFrames();
    setScrollY(40);
    window.dispatchEvent(new Event('scroll'));
    flushFrames();
    setScrollY(2);
    window.dispatchEvent(new Event('scroll'));
    flushFrames();

    expect(header.dataset.scrolled).toBe('false');
  });

  it('honours a custom threshold', () => {
    const header = document.querySelector<HTMLElement>('header');
    if (!header) throw new Error('missing header');
    cleanup = initHeaderScroll(header, 200);

    flushFrames();
    setScrollY(150);
    window.dispatchEvent(new Event('scroll'));
    flushFrames();

    expect(header.dataset.scrolled).toBe('false');
  });

  it('stops listening after dispose', () => {
    const header = document.querySelector<HTMLElement>('header');
    if (!header) throw new Error('missing header');
    const dispose = initHeaderScroll(header);
    flushFrames();
    dispose();

    setScrollY(300);
    window.dispatchEvent(new Event('scroll'));
    flushFrames();

    expect(header.dataset.scrolled).toBe('false');
  });

  it('cancels a pending frame on dispose', () => {
    const header = document.querySelector<HTMLElement>('header');
    if (!header) throw new Error('missing header');
    // Simulate an environment without rAF so the timer fallback is used.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 7);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');

    const dispose = initHeaderScroll(header);
    dispose();

    expect(cancel).toHaveBeenCalledWith(7);
  });

  it('falls back to timers when requestAnimationFrame is unavailable', () => {
    const header = document.querySelector<HTMLElement>('header');
    if (!header) throw new Error('missing header');

    Object.defineProperty(window, 'requestAnimationFrame', {
      value: undefined,
      configurable: true,
    });

    let scheduled: FrameRequestCallback | undefined;
    vi.spyOn(window, 'setTimeout').mockImplementation(((callback: FrameRequestCallback) => {
      scheduled = callback;
      return 5;
    }) as typeof window.setTimeout);

    cleanup = initHeaderScroll(header);
    setScrollY(90);
    scheduled?.(0);

    expect(header.dataset.scrolled).toBe('true');
  });
});

describe('initCopyrightYear', () => {
  it('writes the current year into every placeholder', () => {
    document.body.innerHTML =
      '<p>&copy; <span data-current-year>1999</span></p><p data-current-year>1999</p>';

    initCopyrightYear(document, new Date('2027-03-04T12:00:00Z'));

    const nodes = document.querySelectorAll('[data-current-year]');
    expect(nodes).toHaveLength(2);
    nodes.forEach((node) => expect(node.textContent).toBe('2027'));
  });

  it('defaults to today', () => {
    document.body.innerHTML = '<span data-current-year></span>';
    initCopyrightYear();
    expect(document.querySelector('[data-current-year]')?.textContent).toBe(
      String(new Date().getFullYear()),
    );
  });

  it('returns a no-op disposer', () => {
    document.body.innerHTML = '<span data-current-year></span>';
    expect(typeof initCopyrightYear()).toBe('function');
  });
});
