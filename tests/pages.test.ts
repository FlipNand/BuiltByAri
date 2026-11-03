import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { expandIncludes, markCurrentPage } from '../vite-plugins/html-includes';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const partialsDir = path.join(root, 'partials');

const partials = new Map(
  readdirSync(partialsDir).map((name) => [name, readFileSync(path.join(partialsDir, name), 'utf8')]),
);

interface Page {
  file: string;
  route: string;
  title: RegExp;
  noindex?: boolean;
}

const PAGES: Page[] = [
  { file: 'index.html', route: '/', title: /BuiltByAri/ },
  { file: 'services/index.html', route: '/services/', title: /Services/ },
  { file: 'about/index.html', route: '/about/', title: /About/ },
  { file: 'contact/index.html', route: '/contact/', title: /Contact/ },
  { file: 'privacy/index.html', route: '/privacy/', title: /Privacy/, noindex: true },
  { file: 'terms/index.html', route: '/terms/', title: /Terms/, noindex: true },
  { file: '404.html', route: '/404.html', title: /not found/i, noindex: true },
];

const ROUTES = new Set(PAGES.map((page) => page.route));

function loadPage(page: Page): Document {
  const source = readFileSync(path.join(root, page.file), 'utf8');
  const html = markCurrentPage(expandIncludes(source, (name) => partials.get(name) ?? null));
  return new JSDOM(html).window.document;
}

function textOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Accessible name approximation: text content, aria-label, or a title. */
function accessibleName(element: Element): string {
  return (
    textOf(element) ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    ''
  ).trim();
}

function internalTarget(href: string): string {
  if (!href.startsWith('/')) return '';
  return href.split('#')[0] ?? '';
}

describe.each(PAGES)('$file', (page) => {
  const document = loadPage(page);
  const headingSelector = 'h1, h2, h3, h4, h5, h6';

  it('declares the document language and a viewport', () => {
    expect(document.documentElement.getAttribute('lang')).toBe('en-CA');
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toContain(
      'width=device-width',
    );
  });

  it('has a unique, descriptive title and meta description', () => {
    const title = textOf(document.querySelector('title') as Element);
    expect(title).toMatch(page.title);
    expect(title.length).toBeGreaterThan(10);
    expect(title.length).toBeLessThanOrEqual(75);

    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description.length).toBeLessThanOrEqual(180);
  });

  it('declares a canonical URL, Open Graph tags and robots policy', () => {
    if (page.route === '/404.html') {
      // Error pages carry no canonical and must not be indexed.
      expect(document.querySelector('link[rel="canonical"]')).toBeNull();
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
      return;
    }

    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
    expect(canonical).toBe(`https://web.asteinberg.me${page.route}`);
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      `https://web.asteinberg.me${page.route}`,
    );

    if (page.noindex) {
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
    } else {
      expect(document.querySelector('meta[name="robots"]')).toBeNull();
      expect(document.querySelector('meta[property="og:title"]')).not.toBeNull();
      expect(document.querySelector('meta[property="og:description"]')).not.toBeNull();
      expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
        'https://web.asteinberg.me/og.png',
      );
    }
  });

  it('has exactly one h1 that opens the heading outline', () => {
    const headings = Array.from(document.querySelectorAll(headingSelector));
    expect(headings.filter((node) => node.tagName === 'H1')).toHaveLength(1);
    expect(headings[0]?.tagName).toBe('H1');

    let previous = 1;
    for (const heading of headings) {
      const level = Number(heading.tagName.slice(1));
      expect(level - previous).toBeLessThanOrEqual(1);
      previous = level;
    }
  });

  it('makes the main region skippable and focusable', () => {
    const skip = document.querySelector('a.skip-link');
    expect(skip?.getAttribute('href')).toBe('#main');
    expect(textOf(skip as Element)).toMatch(/skip to main content/i);
    expect(document.body.firstElementChild).toBe(skip);

    const main = document.querySelector('main');
    expect(main?.id).toBe('main');
    expect(main?.getAttribute('tabindex')).toBe('-1');
  });

  it('labels every navigation landmark', () => {
    const navs = Array.from(document.querySelectorAll('nav'));
    expect(navs.length).toBeGreaterThan(0);
    navs.forEach((nav) => {
      expect(nav.getAttribute('aria-label') ?? '').not.toBe('');
    });
  });

  it('marks the current page in the navigation', () => {
    if (page.route === '/404.html') return;
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current.length).toBeGreaterThan(0);
    current.forEach((link) => {
      const href = link.getAttribute('href') ?? '';
      const base = href.split('#')[0] ?? '';
      expect(base === page.route || `${base}/` === page.route).toBe(true);
    });
  });

  it('gives every link an accessible name', () => {
    const links = Array.from(document.querySelectorAll('a'));
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(accessibleName(link), `link ${link.getAttribute('href')}`).not.toBe('');
    });
  });

  it('gives every image an alt attribute and explicit dimensions', () => {
    Array.from(document.querySelectorAll('img')).forEach((img) => {
      expect(img.hasAttribute('alt'), `img ${img.getAttribute('src')}`).toBe(true);
      expect(img.getAttribute('width')).toBeTruthy();
      expect(img.getAttribute('height')).toBeTruthy();
    });
  });

  it('hides decorative sprites from assistive technology', () => {
    Array.from(document.querySelectorAll('svg')).forEach((svg) => {
      const labelled = svg.getAttribute('role') === 'img' || svg.hasAttribute('aria-label');
      expect(svg.getAttribute('aria-hidden') === 'true' || labelled).toBe(true);
    });
  });

  it('keeps every id unique', () => {
    const ids = Array.from(document.querySelectorAll('[id]')).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only links to pages that exist', () => {
    const hrefs = Array.from(document.querySelectorAll('a[href]')).map((a) =>
      internalTarget(a.getAttribute('href') ?? ''),
    );
    hrefs.filter(Boolean).forEach((href) => {
      expect(ROUTES.has(href), `broken internal link: ${href}`).toBe(true);
    });
  });

  it('uses one phone number and one email address everywhere', () => {
    const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'));
    const mails = Array.from(document.querySelectorAll('a[href^="mailto:"]'));

    new Set(telLinks.map((a) => a.getAttribute('href'))).forEach((href) => {
      expect(href).toBe('tel:+14167974821');
    });
    new Set(mails.map((a) => a.getAttribute('href'))).forEach((href) => {
      expect(href).toBe('mailto:aristeinberg@icloud.com');
    });
  });

  it('references only icons that exist in the sprite', () => {
    const sprite = readFileSync(path.join(root, 'public/icons.svg'), 'utf8');
    const ids = new Set(
      Array.from(sprite.matchAll(/<symbol id="([\w-]+)"/g)).map((match) => match[1]),
    );

    Array.from(document.querySelectorAll('use')).forEach((use) => {
      const href = use.getAttribute('href') ?? '';
      expect(href.startsWith('/icons.svg#')).toBe(true);
      expect(ids.has(href.split('#')[1] ?? ''), `missing icon: ${href}`).toBe(true);
    });
  });

  it('preloads both fonts and points at existing files', () => {
    const preloads = Array.from(document.querySelectorAll('link[rel="preload"][as="font"]')).map(
      (link) => link.getAttribute('href'),
    );
    expect(preloads).toEqual(['/fonts/anton-latin.woff2', '/fonts/inter-latin-var.woff2']);

    const fonts = readdirSync(path.join(root, 'public/fonts'));
    preloads.forEach((href) => expect(fonts).toContain(String(href).replace('/fonts/', '')));
  });

  it('links the privacy policy and terms in the footer', () => {
    const footer = document.querySelector('footer');
    expect(footer).not.toBeNull();
    const hrefs = Array.from(footer?.querySelectorAll('a[href]') ?? []).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/privacy/');
    expect(hrefs).toContain('/terms/');
    expect(textOf(footer as Element)).toContain('BuiltByAri');
  });

  it('renders no leftover build directives', () => {
    const html = document.documentElement.outerHTML;
    expect(html).not.toContain('@include');
  });
});

describe('contact page form', () => {
  const document = loadPage(PAGES[3] as Page);
  const form = document.querySelector('form');
  const allControls = Array.from(
    document.querySelectorAll<HTMLElement>('form input, form select, form textarea'),
  );
  // The honeypot is deliberately not a real field: no label text for users, no
  // error slot, out of the tab order. Everything else must behave like a field.
  const controls = allControls.filter((control) => control.getAttribute('name') !== 'botcheck');

  it('opts out of native bubbles in favour of one shared error style', () => {
    expect(form?.hasAttribute('novalidate')).toBe(true);
    expect(form?.hasAttribute('data-contact-form')).toBe(true);
  });

  it('posts to the contact function rather than handing off to a mail app', () => {
    expect(form?.getAttribute('data-endpoint')).toBe('/api/contact');
    expect(form?.getAttribute('action')).toBeNull();
  });

  it('hides the honeypot from assistive tech and the tab order', () => {
    const honeypot = document.querySelector<HTMLInputElement>('input[name="botcheck"]');

    expect(honeypot?.getAttribute('tabindex')).toBe('-1');
    expect(honeypot?.getAttribute('autocomplete')).toBe('off');
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(document.querySelectorAll('input[name="botcheck"]')).toHaveLength(1);
  });

  it('labels every control', () => {
    controls.forEach((control) => {
      const id = control.getAttribute('id');
      const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
      expect(hasLabel, `unlabelled control: ${control.getAttribute('name')}`).not.toBeNull();
    });
  });

  it('points every required control at its error message', () => {
    controls.forEach((control) => {
      const describedBy = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      const name = control.getAttribute('name');
      const error = document.querySelector(`[data-error-for="${name}"]`);
      expect(error, `missing error slot for ${name}`).not.toBeNull();
      expect(error?.id).toBeTruthy();
      expect(describedBy).toContain(error?.id);
      expect(error?.hasAttribute('hidden')).toBe(true);
    });
  });

  it('offers a live status region for submit results', () => {
    const status = document.querySelector('[data-form-status]');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('tabindex')).toBe('-1');
    expect(status?.hasAttribute('hidden')).toBe(true);
  });

  it('offers exactly the project options the validator accepts', () => {
    const options = Array.from(document.querySelectorAll<HTMLOptionElement>('select[name="project"] option'))
      .map((option) => option.value)
      .filter(Boolean);

    expect(options).toEqual(['New website', 'Redesign', 'Monthly care plan', 'Something else']);
  });

  it('asks for consent with a link to the privacy policy', () => {
    const consent = document.querySelector('input[name="consent"]');
    expect(consent?.getAttribute('type')).toBe('checkbox');
    expect(consent?.hasAttribute('required')).toBe(true);
    expect(textOf(document.querySelector('label[for="consent"]') as Element)).toMatch(/privacy/i);
  });
});

describe('404 page', () => {
  const document = loadPage(PAGES[6] as Page);

  it('explains the error and offers a way back', () => {
    const hrefs = Array.from(document.querySelectorAll('main a[href]')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/contact/');
    expect(textOf(document.querySelector('main') as Element)).toMatch(/404/);
  });
});
