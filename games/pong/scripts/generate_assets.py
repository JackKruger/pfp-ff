from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public"
FONT_PATH = "/usr/share/fonts/google-noto-vf/NotoSansMono[wght].ttf"


def rgba(size: tuple[int, int], color=(0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", size, color)


def glow_layer(size: tuple[int, int], draw_fn, blur: float, color: tuple[int, int, int, int]) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw_fn(ImageDraw.Draw(mask))
    mask = mask.filter(ImageFilter.GaussianBlur(blur))
    layer = Image.new("RGBA", size, color)
    layer.putalpha(mask)
    return layer


def alpha_composite(base: Image.Image, *layers: Image.Image) -> Image.Image:
    for layer in layers:
        base.alpha_composite(layer)
    return base


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def save(img: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name)


def make_bg() -> None:
    w, h = 1280, 720
    img = rgba((w, h), (5, 6, 10, 255))
    px = img.load()
    cx, cy = w / 2, h / 2
    for y in range(h):
        for x in range(w):
            nx = (x - cx) / cx
            ny = (y - cy) / cy
            r = math.sqrt(nx * nx + ny * ny)
            horizon = max(0, 1 - abs(y - 390) / 430)
            vignette = max(0, min(1, 1 - (r - 0.28) * 0.95))
            blue = int(8 + 24 * horizon * vignette)
            slate = int(8 + 10 * (1 - abs(nx)) * horizon)
            px[x, y] = (5 + slate // 3, 6 + slate // 2, 10 + blue, 255)

    grid = rgba((w, h))
    gd = ImageDraw.Draw(grid)
    horizon_y = 356
    floor_bottom = h + 120
    for i in range(-18, 19):
        x0 = w / 2 + i * 52
        xh = w / 2 + i * 9
        gd.line((x0, floor_bottom, xh, horizon_y), fill=(42, 210, 255, 30), width=1)
    for j in range(16):
        t = j / 15
        y = horizon_y + (t * t) * (h - horizon_y + 70)
        alpha = int(16 + 28 * t)
        gd.line((0, y, w, y), fill=(42, 210, 255, alpha), width=1)
    grid = grid.filter(ImageFilter.GaussianBlur(0.25))
    img.alpha_composite(grid)

    side = rgba((w, h))
    sd = ImageDraw.Draw(side)
    sd.line((45, 90, 45, 630), fill=(255, 64, 72, 44), width=3)
    sd.line((1235, 90, 1235, 630), fill=(55, 180, 255, 44), width=3)
    img.alpha_composite(side.filter(ImageFilter.GaussianBlur(3)))
    img.alpha_composite(side)
    save(img.convert("RGB"), "bg-playfield.png")


def make_ball_glow() -> None:
    size = 64
    img = rgba((size, size))
    cx = cy = size / 2
    px = img.load()
    for y in range(size):
        for x in range(size):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            a = int(255 * math.exp(-(d * d) / (2 * 12.5 * 12.5)))
            core = int(255 * max(0, 1 - d / 13))
            val = max(180, core) if a else 0
            px[x, y] = (255, 255, 255, min(255, a + core))
    save(img, "ball-glow.png")


def make_paddle() -> None:
    w, h = 36, 240
    img = rgba((w, h))
    box = (9, 10, 27, h - 10)
    img.alpha_composite(glow_layer((w, h), lambda d: rounded_rect(d, box, 12, 255), 7, (255, 255, 255, 175)))
    d = ImageDraw.Draw(img)
    rounded_rect(d, (11, 12, 25, h - 12), 9, (230, 235, 242, 230))
    rounded_rect(d, (14, 18, 22, h - 18), 6, (255, 255, 255, 255))
    highlight = rgba((w, h))
    hd = ImageDraw.Draw(highlight)
    rounded_rect(hd, (10, 12, 26, h - 12), 10, (255, 255, 255, 80))
    img.alpha_composite(highlight)
    save(img, "paddle.png")


def make_spark() -> None:
    size = 32
    img = rgba((size, size))
    cx = cy = size / 2
    px = img.load()
    for y in range(size):
        for x in range(size):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            a = int(245 * math.exp(-(d * d) / (2 * 5.2 * 5.2)))
            px[x, y] = (255, 255, 255, a)
    save(img, "spark.png")


def make_scanlines() -> None:
    random.seed(7)
    w = h = 256
    img = rgba((w, h))
    px = img.load()
    for y in range(h):
        line_alpha = 28 if y % 4 == 0 else 5 if y % 4 == 1 else 0
        for x in range(w):
            noise = random.choice((0, 0, 0, 2, 4, 6))
            px[x, y] = (255, 255, 255, min(34, line_alpha + noise))
    save(img, "scanlines.png")


def make_vignette() -> None:
    w, h = 1280, 720
    img = rgba((w, h))
    px = img.load()
    cx, cy = w / 2, h / 2
    for y in range(h):
        for x in range(w):
            nx = (x - cx) / cx
            ny = (y - cy) / cy
            d = math.sqrt(nx * nx + ny * ny)
            a = int(max(0, min(175, (d - 0.42) * 210)))
            px[x, y] = (0, 0, 0, a)
    save(img, "vignette.png")


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size=size)


def make_wordmark() -> None:
    w, h = 800, 260
    text = "PONG"
    f = font(176)
    img = rgba((w, h))
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    bbox = d.textbbox((0, 0), text, font=f, stroke_width=5)
    x = (w - (bbox[2] - bbox[0])) // 2
    y = (h - (bbox[3] - bbox[1])) // 2 - bbox[1] - 3
    d.text((x, y), text, font=f, fill=255, stroke_width=5, stroke_fill=255)
    for blur, color in ((11, (80, 180, 255, 92)), (6, (255, 60, 82, 82)), (3, (255, 255, 255, 120))):
        glow = Image.new("RGBA", (w, h), color)
        a = mask.filter(ImageFilter.GaussianBlur(blur))
        glow.putalpha(a)
        img.alpha_composite(glow)
    draw = ImageDraw.Draw(img)
    draw.text((x, y), text, font=f, fill=(230, 238, 245, 255), stroke_width=5, stroke_fill=(45, 54, 70, 255))
    draw.text((x, y - 5), text, font=f, fill=(255, 255, 255, 90), stroke_width=1, stroke_fill=(255, 255, 255, 120))
    save(img, "pong-wordmark.png")


def make_center_net() -> None:
    w, h = 24, 720
    img = rgba((w, h))
    d = ImageDraw.Draw(img)
    for y in range(18, h, 52):
        box = (8, y, 16, min(y + 28, h - 16))
        d.rounded_rectangle(box, radius=4, fill=(255, 255, 255, 220))
    img.alpha_composite(glow_layer((w, h), lambda g: [g.rounded_rectangle((8, y, 16, min(y + 28, h - 16)), radius=4, fill=255) for y in range(18, h, 52)], 5, (255, 255, 255, 130)))
    save(img, "center-net.png")


def make_goal_flash() -> None:
    w, h = 400, 720
    img = rgba((w, h))
    px = img.load()
    for y in range(h):
        vertical = 0.72 + 0.28 * math.sin(math.pi * y / h)
        for x in range(w):
            fade = math.exp(-x / 78)
            a = int(220 * fade * vertical)
            px[x, y] = (255, 255, 255, a)
    streaks = rgba((w, h))
    d = ImageDraw.Draw(streaks)
    for y in range(70, h, 86):
        d.line((0, y, 210, y - 28), fill=(255, 255, 255, 115), width=4)
    img.alpha_composite(streaks.filter(ImageFilter.GaussianBlur(4)))
    save(img, "goal-flash.png")


SEGMENTS = {
    0: "abcfed",
    1: "bc",
    2: "abged",
    3: "abgcd",
    4: "fgbc",
    5: "afgcd",
    6: "afgecd",
    7: "abc",
    8: "abcdefg",
    9: "abfgcd",
}


def draw_digit(
    draw: ImageDraw.ImageDraw,
    ox: int,
    digit: int,
    lit=(245, 250, 255, 255),
    dim=(255, 255, 255, 65),
) -> None:
    on = SEGMENTS[digit]
    seg = {
        "a": (ox + 24, 12, ox + 72, 24),
        "b": (ox + 72, 22, ox + 84, 60),
        "c": (ox + 72, 68, ox + 84, 106),
        "d": (ox + 24, 104, ox + 72, 116),
        "e": (ox + 12, 68, ox + 24, 106),
        "f": (ox + 12, 22, ox + 24, 60),
        "g": (ox + 24, 58, ox + 72, 70),
    }
    for key, box in seg.items():
        fill = lit if key in on else dim
        draw.rounded_rectangle(box, radius=5, fill=fill)


def make_digits() -> None:
    w, h = 960, 128
    img = rgba((w, h))
    glow_mask = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(glow_mask)
    for n in range(10):
        draw_digit(gd, n * 96, n, lit=255, dim=0)
    glow = Image.new("RGBA", (w, h), (255, 255, 255, 115))
    glow.putalpha(glow_mask.filter(ImageFilter.GaussianBlur(7)))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    for n in range(10):
        draw_digit(d, n * 96, n)
    save(img, "digits.png")


def make_thumbnail() -> None:
    w, h = 220, 160
    img = Image.open(OUT / "bg-playfield.png").resize((w, h), Image.Resampling.LANCZOS).convert("RGBA")
    d = ImageDraw.Draw(img)
    d.line((w // 2, 24, w // 2, h - 20), fill=(255, 255, 255, 70), width=2)
    for y in range(32, h - 22, 18):
        d.rounded_rectangle((w // 2 - 1, y, w // 2 + 1, y + 8), radius=1, fill=(255, 255, 255, 180))
    d.rounded_rectangle((22, 43, 29, 117), radius=4, fill=(255, 56, 70, 255))
    d.rounded_rectangle((191, 36, 198, 110), radius=4, fill=(50, 177, 255, 255))
    for box, color in [((22, 43, 29, 117), (255, 56, 70, 150)), ((191, 36, 198, 110), (50, 177, 255, 150))]:
        glow = rgba((w, h))
        gd = ImageDraw.Draw(glow)
        gd.rounded_rectangle(box, radius=4, fill=color)
        img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(6)))
    for r, a in ((14, 44), (8, 100), (4, 255)):
        d.ellipse((w // 2 - r, h // 2 - r, w // 2 + r, h // 2 + r), fill=(255, 255, 255, a))
    d.line((91, 85, 65, 92), fill=(255, 255, 255, 80), width=2)
    save(img.convert("RGB"), "thumbnail.png")


def main() -> None:
    make_bg()
    make_ball_glow()
    make_paddle()
    make_spark()
    make_scanlines()
    make_vignette()
    make_wordmark()
    make_center_net()
    make_goal_flash()
    make_digits()
    make_thumbnail()


if __name__ == "__main__":
    main()
