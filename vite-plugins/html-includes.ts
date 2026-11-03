import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Tiny build-time include system.
 *
 * Pages may pull in shared markup with a comment directive:
 *
 *   <!-- @include header.html -->
 *
 * Paths resolve inside `partials/`. Includes are expanded bottom-up so a
 * partial can itself include another partial. Because the work happens in
 * `transformIndexHtml` (build and dev), the built HTML is fully static: no
 * client-side templating, no layout shift, and the page is complete with
 * JavaScript disabled.
 */
const INCLUDE_PATTERN = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
const MAX_INCLUDE_DEPTH = 4;

export interface HtmlIncludesOptions {
  /** Directory that holds the partials, relative to the project root. */
  partialsDir?: string;
}

/** Expand every `@include` directive in `html`, up to `maxDepth` levels. */
export function expandIncludes(
  html: string,
  resolvePartial: (name: string) => string | null,
  maxDepth = MAX_INCLUDE_DEPTH,
): string {
  let output = html;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    let replaced = false;

    output = output.replace(INCLUDE_PATTERN, (directive, name: string) => {
      const partial = resolvePartial(name);
      if (partial === null) return directive;
      replaced = true;
      return partial;
    });

    if (!replaced) break;
  }

  return output;
}

/**
 * Add `aria-current="page"` to the navigation links that match the page's
 * `<body data-page="…">` value. Server-rendered current state means the
 * correct link is announced even before (or without) JavaScript.
 */
export function markCurrentPage(html: string): string {
  const page = /<body[^>]*\sdata-page="([\w-]+)"/.exec(html)?.[1];
  if (!page) return html;

  const link = new RegExp(`data-nav="${page}"`, 'g');
  return html.replace(link, `data-nav="${page}" aria-current="page"`);
}

export function htmlIncludes(options: HtmlIncludesOptions = {}): Plugin {
  const partialsDir = options.partialsDir ?? 'partials';

  return {
    name: 'builtbyari:html-includes',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const root = ctx.server?.config.root ?? process.cwd();
        const base = path.join(root, partialsDir);

        const resolvePartial = (name: string): string | null => {
          const file = path.join(base, name);
          if (!file.startsWith(base) || !existsSync(file)) return null;
          return readFileSync(file, 'utf8');
        };

        return markCurrentPage(expandIncludes(html, resolvePartial));
      },
    },
  };
}
