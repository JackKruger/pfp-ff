#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public" / "art"


def rgba(hex_color, alpha=255):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def save(name, image):
    OUT.mkdir(parents=True, exist_ok=True)
    image.save(OUT / name)


def pixel_rect(draw, xy, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=2, fill=fill, outline=outline, width=width)


def make_tile(name, base, light, dark, accent=None):
    image = Image.new("RGBA", (32, 32), rgba(base))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 31, 31), outline=rgba(dark), width=3)
    draw.rectangle((3, 3, 28, 6), fill=rgba(light, 150))
    draw.rectangle((3, 3, 6, 28), fill=rgba(light, 120))
    draw.rectangle((3, 25, 28, 28), fill=rgba(dark, 120))
    draw.rectangle((25, 3, 28, 28), fill=rgba(dark, 120))
    draw.rectangle((5, 5, 11, 11), fill=rgba(light, 180))
    draw.rectangle((20, 20, 26, 26), fill=rgba(dark, 115))
    if accent:
        draw.line((8, 23, 15, 17, 24, 21), fill=rgba(accent, 120), width=2)
    save(name, image)


def make_finish():
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for y in range(4):
        for x in range(4):
            draw.rectangle(
                (x * 8, y * 8, x * 8 + 7, y * 8 + 7),
                fill=rgba("#f8fafc" if (x + y) % 2 == 0 else "#111827"),
            )
    draw.rectangle((0, 0, 31, 31), outline=rgba("#f59e0b"), width=2)
    save("tile-finish.png", image)


def make_gem():
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.polygon([(16, 2), (29, 15), (16, 30), (3, 15)], fill=rgba("#06b6d4"), outline=rgba("#0891b2"))
    draw.polygon([(16, 3), (27, 14), (16, 14)], fill=rgba("#e0f2fe", 190))
    draw.polygon([(5, 16), (16, 29), (16, 15)], fill=rgba("#0e7490", 130))
    save("pickup-gem.png", image)


def make_boostie(name="pickup-boostie.png"):
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((3, 3, 29, 29), fill=rgba("#fef08a"), outline=rgba("#f59e0b"), width=2)
    draw.polygon([(19, 3), (8, 17), (16, 17), (12, 29), (24, 14), (17, 14)], fill=rgba("#1f2937"))
    draw.line((19, 3, 8, 17, 16, 17, 12, 29), fill=rgba("#facc15"), width=1)
    save(name, image)


def make_bomb():
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((5, 8, 26, 30), fill=rgba("#111827"), outline=rgba("#4b5563"), width=2)
    draw.rectangle((16, 5, 22, 11), fill=rgba("#374151"))
    draw.line((21, 6, 27, 2), fill=rgba("#f59e0b"), width=3)
    draw.ellipse((24, 0, 31, 7), fill=rgba("#fef3c7"))
    draw.ellipse((26, 2, 29, 5), fill=rgba("#ef4444"))
    save("power-bomb.png", image)


def make_shield():
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    points = [(16, 3), (27, 8), (24, 23), (16, 30), (8, 23), (5, 8)]
    draw.polygon(points, fill=rgba("#38bdf8"), outline=rgba("#0369a1"))
    draw.polygon([(16, 6), (23, 10), (20, 19), (16, 23)], fill=rgba("#ecfeff", 150))
    draw.line((9, 9, 23, 23), fill=rgba("#7dd3fc", 160), width=2)
    save("power-shield.png", image)


def make_stun_bolt():
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((3, 3, 29, 29), fill=rgba("#312e81"), outline=rgba("#c4b5fd"), width=2)
    points = [(16, 3), (20, 12), (29, 12), (22, 18), (25, 28), (16, 22), (7, 28), (10, 18), (3, 12), (12, 12)]
    draw.polygon(points, fill=rgba("#a78bfa"))
    draw.line((16, 3, 20, 12, 29, 12), fill=rgba("#f5f3ff"), width=1)
    save("power-stun-bolt.png", image)


def make_burst():
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    rays = [(16, 1), (20, 11), (31, 16), (20, 21), (16, 31), (12, 21), (1, 16), (12, 11)]
    draw.polygon(rays, fill=rgba("#f97316"), outline=rgba("#7c2d12"))
    draw.ellipse((8, 8, 24, 24), fill=rgba("#fef3c7"), outline=rgba("#ea580c"), width=2)
    draw.ellipse((13, 13, 19, 19), fill=rgba("#7c2d12"))
    save("power-burst.png", image)


def make_spikes():
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 20, 31, 31), fill=rgba("#272b36"))
    for x in range(0, 32, 8):
        draw.polygon([(x, 20), (x + 4, 4), (x + 8, 20)], fill=rgba("#f43f5e"), outline=rgba("#881337"))
        draw.line((x + 4, 6, x + 4, 18), fill=rgba("#fecdd3", 130), width=1)
    save("hazard-spikes.png", image)


def skull_base(draw):
    draw.rounded_rectangle((7, 22, 25, 34), radius=3, fill=rgba("#f8fafc"), outline=rgba("#cbd5e1"))
    draw.ellipse((5, 4, 27, 26), fill=rgba("#f8fafc"), outline=rgba("#cbd5e1"), width=1)
    draw.ellipse((8, 11, 15, 18), fill=rgba("#111827"))
    draw.ellipse((18, 11, 25, 18), fill=rgba("#111827"))
    draw.polygon([(16, 17), (13, 21), (19, 21)], fill=rgba("#111827", 190))
    for x in (11, 15, 19):
        draw.line((x, 25, x, 30), fill=rgba("#94a3b8"), width=1)


def make_player(name, variant):
    image = Image.new("RGBA", (32, 36), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    skull_base(draw)
    if variant == "king":
        draw.rectangle((8, 4, 24, 8), fill=rgba("#fbbf24"), outline=rgba("#b45309"))
        draw.polygon([(8, 4), (10, 0), (13, 4)], fill=rgba("#fbbf24"))
        draw.polygon([(14, 4), (16, -2), (19, 4)], fill=rgba("#fbbf24"))
        draw.polygon([(21, 4), (23, 0), (24, 4)], fill=rgba("#fbbf24"))
    elif variant == "ninja":
        draw.rectangle((5, 8, 27, 13), fill=rgba("#1f2937"))
        draw.polygon([(25, 8), (31, 5), (28, 11)], fill=rgba("#374151"))
        draw.polygon([(25, 13), (31, 17), (28, 11)], fill=rgba("#374151"))
    elif variant == "dragon":
        draw.polygon([(10, 5), (7, 0), (14, 4)], fill=rgba("#d1d5db"), outline=rgba("#6b7280"))
        draw.polygon([(22, 5), (25, 0), (18, 4)], fill=rgba("#d1d5db"), outline=rgba("#6b7280"))
        draw.rectangle((12, 2, 20, 6), fill=rgba("#22c55e"))
    elif variant == "wizard":
        draw.rectangle((4, 5, 28, 9), fill=rgba("#6d28d9"))
        draw.polygon([(7, 5), (16, -11), (25, 5)], fill=rgba("#7c3aed"), outline=rgba("#4c1d95"))
        draw.ellipse((14, 0, 18, 4), fill=rgba("#fde047"))
    elif variant == "pirat":
        draw.rectangle((4, 5, 28, 9), fill=rgba("#111827"))
        draw.rectangle((7, 0, 25, 7), fill=rgba("#111827"))
        draw.ellipse((8, 10, 16, 18), outline=rgba("#111827"), width=2)
        draw.line((7, 11, 16, 17), fill=rgba("#111827"), width=1)
    save(name, image)


def main():
    make_player("player-default.png", "default")
    make_player("player-king.png", "king")
    make_player("player-ninja.png", "ninja")
    make_player("player-dragon.png", "dragon")
    make_player("player-wizard.png", "wizard")
    make_player("player-pirat.png", "pirat")

    make_tile("tile-dirt.png", "#7a4b2a", "#b6753c", "#3c2415", "#fbbf24")
    make_tile("tile-stone.png", "#51586c", "#798197", "#252b38")
    make_tile("tile-crate.png", "#9b5d25", "#d18a3d", "#4d2a12", "#f59e0b")
    make_tile("tile-red.png", "#dc2626", "#f87171", "#7f1d1d")
    make_tile("tile-blue.png", "#2563eb", "#60a5fa", "#1e3a8a")
    make_tile("tile-yellow.png", "#eab308", "#fde047", "#854d0e")
    make_tile("tile-green.png", "#16a34a", "#4ade80", "#14532d")
    make_tile("tile-gray.png", "#6b7280", "#d1d5db", "#374151")
    make_finish()

    make_gem()
    make_boostie()
    make_boostie("power-dash.png")
    make_bomb()
    make_shield()
    make_stun_bolt()
    make_burst()
    make_spikes()


if __name__ == "__main__":
    main()
