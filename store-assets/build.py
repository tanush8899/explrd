#!/usr/bin/env python3
"""Generate App Store 6.5" marketing screenshots (1242x2688) from raw captures."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

RAW = "/Users/tanushsanjay/Desktop/explrd/store-assets/raw"
OUT = "/Users/tanushsanjay/Desktop/explrd/store-assets/out"
os.makedirs(OUT, exist_ok=True)

W, H = 1242, 2688
TOP = (26, 29, 38)     # dark slate-charcoal
BOT = (7, 8, 11)       # near-black
GLOW_COLOR = (78, 92, 120)   # muted cool, just for subtle depth
WHITE = (255, 255, 255)

# order, source file, caption
SHOTS = [
    ("01_explore",  "IMG_4189.PNG", "Track your explorations"),
    ("02_globe",    "IMG_4192.PNG", "Watch your world fill in"),
    ("03_friends",  "IMG_4190.PNG", "Outexplore your friends"),
    ("04_passport", "IMG_4191.PNG", "Your travel passport"),
]

# ── layout ──────────────────────────────────────────────────────────────
DEVICE_W = 948
DEVICE_X = (W - DEVICE_W) // 2
DEVICE_Y = 520
CORNER   = 64
HEAD_CAP = 104          # upper bound; actual size auto-fit to the widest caption
SIDE = 72
STROKE = 0              # clean bold, like the in-app "My Places" title


def diagonal_gradient(w, h, top, bot, scale=8):
    sw, sh = w // scale, h // scale
    g = Image.new("RGB", (sw, sh))
    px = g.load()
    for y in range(sh):
        ty = y / (sh - 1)
        for x in range(sw):
            t = (x / (sw - 1) + ty) / 2
            px[x, y] = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    return g.resize((w, h), Image.BILINEAR)


def add_glow(canvas, center, radius, color, intensity):
    g = ImageOps.invert(Image.radial_gradient("L")).resize((radius * 2, radius * 2))
    a = g.point(lambda v: int(v * intensity))
    tint = Image.new("RGBA", (radius * 2, radius * 2), color + (0,))
    tint.putalpha(a)
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    glow.paste(tint, (center[0] - radius, center[1] - radius), tint)
    return Image.alpha_composite(canvas.convert("RGBA"), glow).convert("RGB")


def load_font(size, weight=800):
    f = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", size)
    try:
        axes = f.get_variation_axes()
        vals = []
        for ax in axes:
            nm = ax["name"]
            nm = nm.decode() if isinstance(nm, bytes) else nm
            low = nm.lower()
            if "weight" in low or low == "wght":
                vals.append(weight)
            elif "optical" in low:
                vals.append(min(max(size, ax["minimum"]), ax["maximum"]))
            else:
                vals.append(ax.get("default", ax["minimum"]))
        f.set_variation_by_axes(vals)
    except Exception:
        pass
    return f


def split_lines(caption):
    """Break into 1 or 2 balanced lines so no line is left a single orphan word."""
    words = caption.split()
    n = len(words)
    if n <= 3:                      # 2 lines would orphan a word -> keep on one line
        return [caption]
    best = None                     # n>=4: two lines, each with >=2 words
    for k in range(2, n - 1):
        l1, l2 = " ".join(words[:k]), " ".join(words[k:])
        m = max(len(l1), len(l2))
        if best is None or m < best[0]:
            best = (m, [l1, l2])
    return best[1]


def fit_size(lines, maxw, cap):
    """Largest font (<= cap) at which every line fits within maxw, accounting for stroke."""
    size = cap
    while size > 44:
        f = load_font(size)
        d = ImageDraw.Draw(Image.new("RGB", (8, 8)))
        if all(d.textlength(ln, font=f) + 2 * STROKE <= maxw for ln in lines):
            return size
        size -= 2
    return size


def round_corners(im, rad):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1],
                                           radius=rad, fill=255)
    im = im.convert("RGBA")
    im.putalpha(mask)
    return im


def build(name, src, lines, size):
    canvas = diagonal_gradient(W, H, TOP, BOT)
    canvas = add_glow(canvas, (W // 2, 540), 820, GLOW_COLOR, 0.16)

    # device image
    shot = Image.open(os.path.join(RAW, src)).convert("RGB")
    dev_h = round(DEVICE_W * shot.height / shot.width)
    shot = shot.resize((DEVICE_W, dev_h), Image.LANCZOS)
    shot = round_corners(shot, CORNER)

    # soft drop shadow
    blur = 58
    pad = blur * 3
    sh = Image.new("RGBA", (DEVICE_W + pad * 2, dev_h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [pad, pad, pad + DEVICE_W, pad + dev_h], radius=CORNER, fill=(0, 0, 0, 175))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(sh, (DEVICE_X - pad, DEVICE_Y - pad + 30), sh)

    # device + crisp edge highlight
    canvas.paste(shot, (DEVICE_X, DEVICE_Y), shot)
    edge = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(
        [DEVICE_X, DEVICE_Y, DEVICE_X + DEVICE_W - 1, DEVICE_Y + dev_h - 1],
        radius=CORNER, outline=(255, 255, 255, 46), width=2)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), edge)

    # headline, vertically centered in band above the device
    font = load_font(size)
    tmp = ImageDraw.Draw(canvas)
    lh = int(size * 1.12)
    block_h = lh * len(lines)
    band_top, band_bot = 96, DEVICE_Y - 48
    y0 = band_top + (band_bot - band_top - block_h) // 2

    def draw_lines(d, dy, fill):
        y = y0 + dy
        for ln in lines:
            tw = d.textlength(ln, font=font)
            d.text(((W - tw) / 2, y), ln, font=font, fill=fill,
                   stroke_width=STROKE, stroke_fill=fill)
            y += lh

    # soft shadow layer behind text for lift
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw_lines(ImageDraw.Draw(shadow), 5, (0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    canvas = Image.alpha_composite(canvas, shadow)

    draw_lines(ImageDraw.Draw(canvas), 0, WHITE)

    canvas = canvas.convert("RGB")
    out = os.path.join(OUT, name + ".png")
    canvas.save(out, "PNG")
    print(f"{name}: {W}x{H}  ({len(lines)} line headline)  -> {out}")


# One shared headline size: the largest that fits every caption's layout,
# so all four screens look consistent.
maxw = W - 2 * SIDE
layouts = [(n, s, split_lines(c)) for n, s, c in SHOTS]
common = min(fit_size(lines, maxw, HEAD_CAP) for _, _, lines in layouts)
print(f"headline size: {common}")

for n, s, lines in layouts:
    build(n, s, lines, common)
print("done")
