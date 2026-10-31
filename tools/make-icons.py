"""Render icons/icon-192.png and icons/icon-512.png (same design as icons/icon.svg)."""
from pathlib import Path

from PIL import Image, ImageDraw

TEAL = (15, 76, 70, 255)
GOLD = (232, 213, 163, 255)
OUT = Path(__file__).resolve().parent.parent / "icons"
SCALE = 4  # supersample for smooth edges


def render(size: int) -> Image.Image:
    s = 512 * SCALE
    k = SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Full-bleed background so the icon also works as "maskable"
    d.rectangle([0, 0, s, s], fill=TEAL)
    # Crescent: gold ring with a teal disc cut out
    d.ellipse([(256 - 120) * k, (230 - 120) * k, (256 + 120) * k, (230 + 120) * k],
              outline=GOLD, width=28 * k)
    d.ellipse([(310 - 90) * k, (180 - 90) * k, (310 + 90) * k, (180 + 90) * k], fill=TEAL)
    # Stand
    w = 28 * k
    d.line([(256 * k, 360 * k), (256 * k, 420 * k)], fill=GOLD, width=w)
    d.line([(220 * k, 420 * k), (292 * k, 420 * k)], fill=GOLD, width=w)
    for x, y in ((256, 360), (220, 420), (292, 420)):
        r = 14 * k
        d.ellipse([x * k - r, y * k - r, x * k + r, y * k + r], fill=GOLD)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    for size in (192, 512):
        path = OUT / f"icon-{size}.png"
        render(size).save(path)
        print("wrote", path)
