#!/usr/bin/env python3
"""
Generate GitHub social preview (1280x640 PNG) for dsh-project-brain.

Source: docs/screenshots/01.png (Dashboard total view)
Output: docs/social-preview.png
Run:   python3 scripts/build-social-preview.py
"""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "screenshots" / "01.png"
OUT = ROOT / "docs" / "social-preview.png"

W, H = 1280, 640

# Brand palette (matches Dashboard accent + neutral surface)
BG_TOP = (250, 250, 249)
BG_BOT = (235, 235, 233)
ACCENT = (34, 197, 94)          # Dashboard green chip
INK_PRIMARY = (24, 24, 27)
INK_SECONDARY = (82, 82, 91)
INK_MUTED = (113, 113, 122)
SURFACE = (255, 255, 255)
BORDER = (228, 228, 231)


def load_font(size: int, bold: bool = False, cn: bool = False):
    candidates = []
    if cn:
        candidates.append("/System/Library/Fonts/STHeiti Medium.ttc")
        candidates.append("/System/Library/Fonts/PingFang.ttc")
    else:
        if bold:
            candidates.append("/System/Library/Fonts/Supplemental/Arial Black.ttf")
            candidates.append("/System/Library/Fonts/Helvetica.ttc")
        else:
            candidates.append("/System/Library/Fonts/Helvetica.ttc")
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def main():
    if not SRC.exists():
        raise SystemExit(f"Missing source screenshot: {SRC}")

    # Background gradient
    canvas = Image.new("RGB", (W, H), BG_TOP)
    draw = ImageDraw.Draw(canvas)
    for y in range(H):
        t = y / (H - 1)
        r = int(BG_TOP[0] * (1 - t) + BG_BOT[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOT[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOT[2] * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Subtle accent stripe top-left
    draw.rectangle([0, 0, 8, H], fill=ACCENT)

    # ---- LEFT TEXT BLOCK ----
    title_font = load_font(54, bold=True)
    subtitle_cn_font = load_font(24, bold=False, cn=True)
    badge_font = load_font(20, bold=True)
    tagline_font = load_font(20, bold=False, cn=False)
    url_font = load_font(18, bold=False, cn=False)

    PAD = 72
    title = "dsh-project-brain"
    draw.text((PAD, 132), title, font=title_font, fill=INK_PRIMARY)

    subtitle_cn = "理解代码架构 · 记住项目历史 · 跨 Session 保持上下文"
    draw.text((PAD, 215), subtitle_cn, font=subtitle_cn_font, fill=INK_SECONDARY)

    # Badge
    badge_y = 282
    badge_w = 240
    badge_h = 40
    draw.rounded_rectangle(
        [(PAD, badge_y), (PAD + badge_w, badge_y + badge_h)],
        radius=20,
        fill=ACCENT,
    )
    draw.text(
        (PAD + 24, badge_y + 8),
        "v1.0.0  STABLE",
        font=badge_font,
        fill=(255, 255, 255),
    )

    # One-liner tagline (English)
    tagline_en = "Persistent project memory for DSH"
    draw.text((PAD, 360), tagline_en, font=tagline_font, fill=INK_PRIMARY)

    # Stats row
    stats = "16 tools · 39/39 verified · 6 languages · local-first"
    stat_font = load_font(17)
    draw.text((PAD, 398), stats, font=stat_font, fill=INK_MUTED)

    # GitHub URL footer
    url = "github.com/yj-liuzepeng/dsh-project-brain"
    draw.text((PAD, H - 84), url, font=url_font, fill=INK_SECONDARY)

    # ---- RIGHT PREVIEW ----
    preview_src = Image.open(SRC).convert("RGB")
    # Fit into 560x380 (keeping aspect ratio); narrower so left text has room
    target_w = 540
    target_h = 400
    sw, sh = preview_src.size
    ratio = min(target_w / sw, target_h / sh)
    new_w, new_h = int(sw * ratio), int(sh * ratio)
    preview_resized = preview_src.resize((new_w, new_h), Image.LANCZOS)

    # Card with shadow
    card_x = 740
    card_y = 130
    card_w = target_w + 16
    card_h = target_h + 16
    # Shadow
    shadow = Image.new("RGB", (card_w + 12, card_h + 12), (220, 220, 220))
    canvas.paste(shadow, (card_x + 8, card_y + 8))
    # Card background
    draw.rectangle(
        [(card_x, card_y), (card_x + card_w, card_y + card_h)],
        fill=SURFACE,
        outline=BORDER,
        width=1,
    )
    # Preview inside card (centered with 8px padding)
    canvas.paste(
        preview_resized,
        (card_x + 8 + (target_w - new_w) // 2, card_y + 8 + (target_h - new_h) // 2),
    )

    canvas.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()