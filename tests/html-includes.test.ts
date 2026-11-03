import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { expandIncludes, htmlIncludes, markCurrentPage } from '../vite-plugins/html-includes';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const partials: Record<string, string> = {
  'header.html': '<header>Header <!-- @include nav.html --></header>',
  'nav.html': '<nav>Links</nav>',
};

const resolve = (name: string): string | null => partials[name] ?? null;

/** Pull the transformIndexHtml hook out of the plugin with a usable signature. */
type TransformHook = (html: string, ctx: never) => unknown;

function transformHandler(): (html: string) => unknown {
  const plugin = htmlIncludes();
  const transform = plugin.transformIndexHtml as { handler?: TransformHook } | undefined;
  const handler = transform?.handler;
  if (typeof handler !== 'function') throw new Error('missing transform hook');
  return (html: string) => handler(html, {} as never);
}

describe('expandIncludes', () => {
  it('replaces a directive with the partial', () => {
    expect(expandIncludes('<main><!-- @include header.html --></main>', resolve, 1)).toBe(
      '<main><header>Header <!-- @include nav.html --></header></main>',
    );
  });

  it('expands nested includes', () => {
    expect(expandIncludes('<!-- @include header.html -->', resolve, 3)).toBe(
      '<header>Header <nav>Links</nav></header>',
    );
  });

  it('stops at the depth limit', () => {
    const output = expandIncludes('<!-- @include header.html -->', resolve, 1);
    expect(output).toBe('<header>Header <!-- @include nav.html --></header>');
  });

  it('leaves unknown partials untouched so the page still renders', () => {
    expect(expandIncludes('<p><!-- @include missing.html --></p>', resolve)).toBe(
      '<p><!-- @include missing.html --></p>',
    );
  });

  it('tolerates spacing inside the directive', () => {
    const loose = '<p><!--@include   nav.html   --></p>';
    expect(expandIncludes(loose, resolve)).toBe('<p><nav>Links</nav></p>');
  });

  it('returns the input unchanged when there is nothing to include', () => {
    expect(expandIncludes('<p>Plain</p>', resolve)).toBe('<p>Plain</p>');
  });
});

describe('markCurrentPage', () => {
  const page = `<!doctype html><html><body data-page="services">
    <a data-nav="services">Services</a><a data-nav="about">About</a>
    <a data-nav="services">Mobile services</a></body></html>`;

  it('marks every link that matches the page', () => {
    const output = markCurrentPage(page);
    expect(output.match(/aria-current="page"/g)).toHaveLength(2);
    expect(output).toContain('data-nav="about"');
  });

  it('does nothing without a data-page attribute', () => {
    const html = '<body><a data-nav="services">Services</a></body>';
    expect(markCurrentPage(html)).toBe(html);
  });
});

describe('htmlIncludes plugin', () => {
  it('expands the real partials during transformIndexHtml', () => {
    const handler = transformHandler();

    const pageHtml = readFileSync(path.join(root, 'about/index.html'), 'utf8');
    const output = handler(pageHtml) as string;

    expect(output).toContain('class="site-header"');
    expect(output).toContain('class="site-footer"');
    expect(output).not.toContain('@include');
    expect(output.match(/aria-current="page"/g)).toHaveLength(2);
  });

  it('ignores partial paths that escape the partials directory', () => {
    const handler = transformHandler();
    const output = handler(
      '<body data-page="home"><!-- @include ../index.html --></body>',
    ) as string;

    expect(output).toContain('@include');
  });
});
