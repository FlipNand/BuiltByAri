#!/usr/bin/env python3
"""
Generate the raster brand assets that cannot be expressed as SVG:

  public/og.png              1200x630  social share card (Open Graph / Twitter)
  public/apple-touch-icon.png 180x180  iOS home-screen icon

The design mirrors the site: paper #f4f2ed, ink #0c0c0b, Anton for display
type, Inter for text, hairlines in #d8d3c8.

Usage:
    python3 -m pip install --user pillow
    python3 tools/generate-assets.py

Fonts are downloaded once to a temp directory from the Google Fonts
repository (the same source as the woff2 files in public/fonts).
"""

from __future__ import annotations

import io
import pathlib
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
CACHE = pathlib.Path("/tmp/builtbyari-fonts")

FONT_URLS = {
    "anton": "https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf",
    "inter": "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
}

PAPER = (244, 242, 237)
INK = (12, 12, 11)
INK_SOFT = (87, 84, 77)
LINE = (216, 211, 200)


def font(name: str, size: int, variation: str | None = None) -> ImageFont.FreeTypeFont:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{name}.ttf"
    if not path.exists():
        with urllib.request.urlopen(FONT_URLS[name]) as response:
            path.write_bytes(response.read())
    loaded = ImageFont.truetype(str(path), size)
    if variation:
        try:
            loaded.set_variation_by_name(variation)
        except (OSError, ValueError):
            pass
    return loaded


def tracked_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    face: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    tracking: float = 0.0,
) -> None:
    """Draw text with letter spacing, which Pillow does not support natively."""
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=face, fill=fill)
        x += draw.textlength(char, font=face) + tracking


def build_og() -> Image.Image:
    width, height = 1200, 630
    image = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, 23, height), fill=INK)

    left = 96
    tracked_text(draw, (left, 58), "TORONTO · WEB DESIGN", font("inter", 19, "SemiBold"), INK, 3.1)

    # The wordmark spans the full card width. Anton is drawn on its baseline
    # (anchor "ls") so cap heights line up regardless of the font's metrics.
    wordmark = "BUILT BY ARI"
    target = width - left - 64
    size = 220
    display = font("anton", size)
    measured = draw.textlength(wordmark, font=display)
    display = font("anton", round(size * target / measured))

    draw.text((left - 4, 336), wordmark, font=display, fill=INK, anchor="ls")

    lead = font("inter", 27, "Regular")
    draw.text((left, 430), "Custom websites for local", font=lead, fill=INK_SOFT)
    draw.text((left, 468), "businesses across the GTA.", font=lead, fill=INK_SOFT)

    draw.rectangle((left, 542, width - 96, 543), fill=LINE)

    small = font("inter", 21, "Medium")
    draw.text((left, 566), "web.asteinberg.me  ·  416-797-4821", font=small, fill=INK)
    right_label = "Custom-built. Fixed pricing."
    right_width = draw.textlength(right_label, font=small)
    draw.text((width - 96 - right_width, 566), right_label, font=small, fill=INK_SOFT)

    return image


def build_touch_icon() -> Image.Image:
    size = 720  # 4x supersample, downscaled for clean edges
    scale = size / 64
    image = Image.new("RGB", (size, size), INK)
    draw = ImageDraw.Draw(image)

    outer = [(32, 11), (51.5, 53), (42.2, 53), (38.6, 43.8), (25.4, 43.8), (21.8, 53), (12.5, 53)]
    inner = [(32, 26.1), (36.6, 38.2), (27.4, 38.2)]

    draw.polygon([(x * scale, y * scale) for x, y in outer], fill=PAPER)
    draw.polygon([(x * scale, y * scale) for x, y in inner], fill=INK)

    return image.resize((180, 180), Image.LANCZOS)


def main() -> None:
    og = build_og()
    og.save(PUBLIC / "og.png", optimize=True)

    icon = build_touch_icon()
    icon.save(PUBLIC / "apple-touch-icon.png", optimize=True)

    for name in ("og.png", "apple-touch-icon.png"):
        path = PUBLIC / name
        print(f"wrote {path.relative_to(ROOT)} — {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
