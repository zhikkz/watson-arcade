"""位图字体生成：扫描源码里用到的全部字符，用「缝合像素字体」(OFL-1.1) 渲染成字形图集。

输出 src/assets/font.png（白色字形、透明底）与 font.json：
  {"12": {"h": 12, "g": {"张": [x, y, w], ...}}, "10": {...}, "8": {...}}
运行时逐字 blit，保证任何浏览器下都是整像素、无抗锯齿。
"""
import json
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(HERE, '..')
SRC_DIRS = [os.path.join(PROJ, 'src')]
OUT_PNG = os.path.join(PROJ, 'src', 'assets', 'font.png')
OUT_JSON = os.path.join(PROJ, 'src', 'assets', 'font.json')

# (字号, 裁剪起始行, 行高)
SIZES = [(12, 4, 12), (10, 4, 10), (8, 2, 8)]
EXTRA = '，。！？：；、“”‘’（）《》【】〈〉「」…—·×÷±≈≠≤≥→←↑↓↔★☆♥♦●○■□▲▼◆◇▶◀∞°％％＋－％‰∑√∫πΔΩλμσθαβγψℏ℃'


def font_path(px):
    return os.path.join(PROJ, 'node_modules', '@fontsource', f'fusion-pixel-{px}px-proportional-sc', 'files',
                        f'fusion-pixel-{px}px-proportional-sc-latin-400-normal.woff')


def collect_charset():
    chars = set(chr(c) for c in range(32, 127))
    chars.update(EXTRA)
    for d in SRC_DIRS:
        for root, _, files in os.walk(d):
            for fn in files:
                if fn.endswith(('.js', '.mjs', '.html', '.json')) and fn not in ('atlas.json', 'font.json'):
                    with open(os.path.join(root, fn), encoding='utf-8') as f:
                        for ch in f.read():
                            if ord(ch) > 126 and not ch.isspace():
                                chars.add(ch)
    chars.discard('﻿')
    return sorted(chars)


def build():
    chars = collect_charset()
    W = 512
    blocks = []
    meta = {}
    missing = {}
    for px, top, h in SIZES:
        font = ImageFont.truetype(font_path(px), px)
        # 用于检测缺字：.notdef 的渲染结果
        glyphs = {}
        x = y = 0
        rows = [np.zeros((h, W), bool)]
        miss = []
        for ch in chars:
            adv = int(round(font.getlength(ch)))
            if adv <= 0:
                adv = px // 2
            im = Image.new('L', (adv + 8, px + 12), 0)
            d = ImageDraw.Draw(im)
            d.fontmode = '1'
            d.text((2, 0), ch, font=font, fill=255)
            a = np.array(im) > 0
            cell = a[top:top + h, 2:2 + adv + 4]
            xs = np.nonzero(cell.any(axis=0))[0]
            w = adv
            if len(xs) and xs.max() + 1 > w:
                w = xs.max() + 1
            if ch != ' ' and not cell.any():
                miss.append(ch)
            cell = cell[:, :w]
            if x + w + 1 > W:
                x = 0
                y += 1
                rows.append(np.zeros((h, W), bool))
            rows[y][:, x:x + w] = cell
            glyphs[ch] = [x, y, w]
            x += w + 1
        block = np.concatenate([np.pad(r, ((0, 1), (0, 0))) for r in rows], axis=0)
        blocks.append((px, h, block, glyphs))
        if miss:
            missing[px] = miss
    yoff = 0
    sheets = []
    for px, h, block, glyphs in blocks:
        g = {ch: [gx, yoff + gy * (h + 1), gw] for ch, (gx, gy, gw) in glyphs.items()}
        meta[str(px)] = {'h': h, 'g': g}
        sheets.append(block)
        yoff += block.shape[0]
    full = np.concatenate(sheets, axis=0)
    rgba = np.zeros(full.shape + (4,), np.uint8)
    rgba[full] = (255, 255, 255, 255)
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(OUT_PNG, optimize=True)
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, separators=(',', ':'))
    print(f'font: {len(chars)} chars, sheet {rgba.shape[1]}x{rgba.shape[0]}')
    for px, miss in missing.items():
        print(f'  [warn] {px}px 缺字: {"".join(miss)}')


if __name__ == '__main__':
    build()
