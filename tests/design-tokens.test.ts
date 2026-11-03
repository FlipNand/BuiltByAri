import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = path.join(root, 'src/styles');

const tokenSource = readFileSync(path.join(stylesDir, 'tokens.css'), 'utf8');
const styleFiles = readdirSync(stylesDir).filter((name) => name.endsWith('.css') && name !== 'tokens.css');
const styleSource = styleFiles
  .map((name) => readFileSync(path.join(stylesDir, name), 'utf8'))
  .join('\n');

/** `--name: value;` declarations from :root, ignoring comments. */
function parseTokens(css: string): Map<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = new Map<string, string>();

  for (const match of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) tokens.set(name, value.trim());
  }

  return tokens;
}

const tokens = parseTokens(tokenSource);

function readColor(name: string): { r: number; g: number; b: number; a: number } {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing colour token ${name}`);

  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const int = Number.parseInt(hex[1], 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255, a: 1 };
  }

  const rgb = /^rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)%?)?\s*\)$/i.exec(value);
  if (rgb) {
    const [, r = '0', g = '0', b = '0', alpha = '1'] = rgb;
    return {
      r: Number(r),
      g: Number(g),
      b: Number(b),
      a: alpha.includes('.') ? Number(alpha) : Number(alpha) > 1 ? Number(alpha) / 100 : Number(alpha),
    };
  }

  throw new Error(`Unsupported colour value for ${name}: ${value}`);
}

/** Flatten an alpha colour over an opaque background. */
function over(
  colour: { r: number; g: number; b: number; a: number },
  background: { r: number; g: number; b: number },
): { r: number; g: number; b: number } {
  const blend = (channel: number, base: number) => Math.round(channel * colour.a + base * (1 - colour.a));
  return {
    r: blend(colour.r, background.r),
    g: blend(colour.g, background.g),
    b: blend(colour.b, background.b),
  };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [lr, lg, lb] = [r, g, b]
    .map((channel) => channel / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(foreground: string, background: string): number {
  const bg = readColor(background);
  const fg = readColor(foreground);
  const bgOpaque = over(bg, { r: 255, g: 255, b: 255 });
  const fgOpaque = over(fg, bgOpaque);

  const [light, dark] = [luminance(fgOpaque), luminance(bgOpaque)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

describe('design tokens', () => {
  it('defines every token exactly once, apart from the reduced-motion overrides', () => {
    const names = Array.from(tokenSource.matchAll(/(--[\w-]+)\s*:/g)).map((match) => String(match[1]));
    const seen = new Set<string>();
    const duplicates = names.filter((name) => {
      const duplicate = seen.has(name);
      seen.add(name);
      return duplicate;
    });

    duplicates.forEach((name) => expect(String(name)).toMatch(/^--duration-/));
    expect(duplicates.length).toBeLessThanOrEqual(3);
  });

  it('groups tokens by a documented prefix', () => {
    const allowed = [
      'color',
      'font',
      'text',
      'leading',
      'tracking',
      'weight',
      'space',
      'section',
      'container',
      'grid',
      'measure',
      'border',
      'radius',
      'shadow',
      'duration',
      'ease',
      'focus',
      'target',
      'layer',
    ];

    for (const name of tokens.keys()) {
      const prefix = name.replace(/^--/, '').split('-')[0];
      expect(allowed, `unprefixed token ${name}`).toContain(prefix);
    }
  });

  it('resolves every var() reference', () => {
    const referenced = new Set(
      Array.from(styleSource.matchAll(/var\((--[\w-]+)/g)).map((match) => match[1]),
    );
    const tokenNames = new Set(tokens.keys());

    for (const name of referenced) {
      expect(tokenNames.has(name as string), `undefined custom property ${name}`).toBe(true);
    }
  });

  it('keeps raw colour values out of component styles', () => {
    const literals = [
      ...styleSource.matchAll(/#[0-9a-f]{3,8}\b/gi),
      ...styleSource.matchAll(/\b(?:rgb|hsl)a?\(/gi),
    ].map((match) => match[0]);

    expect(literals, `raw colours in CSS: ${literals.join(', ')}`).toEqual([]);
  });

  it.each([
    ['--color-ink', '--color-paper'],
    ['--color-ink-soft', '--color-paper'],
    ['--color-paper', '--color-ink'],
    ['--color-tint-ink', '--color-tint'],
    ['--color-danger', '--color-paper'],
    ['--color-success', '--color-paper'],
    ['--color-paper-wash-text', '--color-ink'],
    ['--color-paper-wash-muted', '--color-ink'],
    ['--color-ink-hover', '--color-paper'],
  ])('%s on %s meets WCAG AA for body text', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses the muted token only where large text or decoration is allowed', () => {
    expect(contrast('--color-ink-faint', '--color-paper')).toBeGreaterThanOrEqual(3);
    expect(contrast('--color-ink-faint', '--color-paper')).toBeLessThan(4.5);
  });

  it('builds the spacing scale on a 4px base', () => {
    const spacing = Array.from(tokens.entries())
      .filter(([name]) => name.startsWith('--space-'))
      .map(([, value]) => Number.parseFloat(value.replace('rem', '')) * 16);

    expect(spacing.length).toBeGreaterThanOrEqual(8);
    spacing.forEach((value) => expect(value % 4).toBe(0));
    expect([...spacing].sort((a, b) => a - b)).toEqual(spacing);
    expect(spacing[0]).toBeGreaterThanOrEqual(4);
  });

  it('defines one fluid type scale in a predictable order', () => {
    const size = (name: string) => {
      const value = tokens.get(name) ?? '';
      const match = /clamp\(([\d.]+)rem/.exec(value) ?? /^([\d.]+)rem$/.exec(value);
      if (!match?.[1]) throw new Error(`No rem size in ${name}`);
      return Number.parseFloat(match[1]);
    };

    expect(size('--text-display-xl')).toBeGreaterThan(size('--text-display-lg'));
    expect(size('--text-display-lg')).toBeGreaterThan(size('--text-display-md'));
    expect(size('--text-display-md')).toBeGreaterThan(size('--text-display-sm'));
    expect(size('--text-display-sm')).toBeGreaterThan(size('--text-title'));
    expect(size('--text-title')).toBeGreaterThan(size('--text-body'));

    for (const [name, value] of tokens) {
      if (!name.startsWith('--text-')) continue;
      const fluid = name.startsWith('--text-display') || name === '--text-title' || name === '--text-lead';
      expect(value, `${name} fluid sizes use clamp()`).toMatch(fluid ? /^clamp\(/ : /^(?:[\d.]+rem|[\d.]+px)$/);
    }
  });

  it('ships system font fallbacks for both families', () => {
    ['--font-display', '--font-sans', '--font-mono'].forEach((name) => {
      const stack = tokens.get(name) ?? '';
      expect(stack.split(',').length).toBeGreaterThan(1);
    });
  });

  it('defines motion, radius, shadow and layer tokens', () => {
    ['--radius-xs', '--radius-sm', '--radius-md', '--radius-pill'].forEach((name) =>
      expect(tokens.has(name)).toBe(true),
    );
    ['--duration-fast', '--duration-base', '--duration-slow'].forEach((name) =>
      expect(tokens.has(name)).toBe(true),
    );
    ['--ease-out', '--ease-in-out'].forEach((name) => expect(tokens.has(name)).toBe(true));
    ['--layer-sticky', '--layer-nav', '--layer-skip'].forEach((name) =>
      expect(tokens.has(name)).toBe(true),
    );
    expect(tokens.get('--focus-width')).toBe('2px');
    expect(tokens.get('--target-min')).toBe('44px');
  });

  it('respects reduced motion by collapsing durations', () => {
    expect(tokenSource).toMatch(/prefers-reduced-motion: reduce/);
  });
});
