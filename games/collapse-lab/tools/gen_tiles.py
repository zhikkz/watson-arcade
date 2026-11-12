"""各实验区的图块集（24x24）：实心填充、四向边缘覆盖层、单向平台、背景墙、尖刺等。

运行时合成方式：先画 fill，再按暴露的边叠加 edge_*（顶边最后画）。
命名：t/<biome>/<piece>[/variant]
"""
import numpy as np
from px import (new, rect, frame, hline, vline, put, line, ellipse, poly, shade, mix, hexc,
                noise_shade, Sprite, flip_h, flip_v, rotate90, blit)

T = 24


def rng_for(name):
    return np.random.default_rng(abs(hash(name)) % (2 ** 32) if False else sum(ord(c) * (i + 7) for i, c in enumerate(name)))


def speckle(a, rng, cols, n, x0=0, y0=0, w=None, h=None):
    w = a.shape[1] if w is None else w
    h = a.shape[0] if h is None else h
    for _ in range(n):
        x = int(rng.integers(x0, x0 + w))
        y = int(rng.integers(y0, y0 + h))
        if a[y, x, 3]:
            a[y, x] = cols[int(rng.integers(0, len(cols)))]


# ---------------------------------------------------------------- 通用部件

def fill_tiles(P, rng, n=4):
    """墙体内部：暗色、低对比的砌块纹理。"""
    out = []
    base = P['fill']
    dk = shade(base, 0.8)
    lt = shade(base, 1.12)
    for v in range(n):
        a = new(T, T)
        rect(a, 0, 0, T, T, base)
        style = P.get('fill_style', 'block')
        if style == 'block':
            # 错缝砌块
            for row in range(2):
                y = row * 12
                hline(a, 0, T - 1, y + 11, dk)
                off = 0 if (row + v) % 2 == 0 else 12
                vline(a, (off + 11) % T, y, y + 10, dk)
                hline(a, 0, T - 1, y, lt if rng.random() < 0.35 else base)
        elif style == 'panel':
            frame(a, 0, 0, T, T, dk)
            hline(a, 1, T - 2, 1, lt)
            for (x, y) in ((3, 3), (T - 4, 3), (3, T - 4), (T - 4, T - 4)):
                put(a, x, y, lt)
                put(a, x, y + 1, dk)
        elif style == 'brick':
            for row in range(3):
                y = row * 8
                hline(a, 0, T - 1, y + 7, dk)
                off = 0 if (row + v) % 2 == 0 else 6
                for x in (off + 5, off + 17):
                    vline(a, x % T, y, y + 6, dk)
        elif style == 'plate':
            hline(a, 0, T - 1, T - 1, dk)
            vline(a, T - 1, 0, T - 1, dk)
            hline(a, 0, T - 2, 0, lt)
            if v % 2 == 0:
                line(a, 4, 18, 9, 13, dk)
        a = noise_shade(a, rng, 3)
        speckle(a, rng, [dk, lt], 6)
        out.append(a)
    return out


def edge_top(P, rng, v=0):
    """地面：顶部是地板面层，下面一条阴影过渡到墙体。"""
    a = new(T, T)
    fl = P['floor']
    hi = shade(fl, 1.22)
    dk = shade(fl, 0.62)
    style = P.get('floor_style', 'terrazzo')
    hgt = P.get('floor_h', 7)
    rect(a, 0, 0, T, hgt, fl)
    hline(a, 0, T - 1, 0, hi)
    hline(a, 0, T - 1, hgt - 1, dk)
    hline(a, 0, T - 1, hgt, shade(P['fill'], 0.6))
    hline(a, 0, T - 1, hgt + 1, shade(P['fill'], 0.8))
    if style == 'terrazzo':
        speckle(a, rng, [shade(fl, 0.8), shade(fl, 1.15), P.get('fleck', (150, 120, 100, 255))], 14, 0, 1, T, hgt - 2)
        if v == 1:
            vline(a, 11, 1, hgt - 2, shade(fl, 0.8))   # 铜条分格
    elif style == 'metal':
        vline(a, 0, 1, hgt - 2, dk)
        vline(a, T - 1, 1, hgt - 2, hi)
        hline(a, 2, T - 3, 2, shade(fl, 1.1))
        for x in (3, T - 4):
            put(a, x, hgt - 3, dk)
        if 'glow' in P:
            hline(a, 4, T - 5, hgt - 2, P['glow'])
    elif style == 'grate':
        for x in range(1, T, 3):
            vline(a, x, 1, hgt - 2, dk)
        hline(a, 0, T - 1, 3, shade(fl, 0.85))
    elif style == 'ceramic':
        vline(a, 0, 1, hgt - 2, shade(fl, 0.82))
        hline(a, 1, T - 1, 1, shade(fl, 1.12))
        if v == 1 and 'stripe' in P:
            for x in range(-4, T, 8):
                poly(a, [(x, hgt - 1), (x + 4, hgt - 1), (x + 7, 2), (x + 3, 2)], P['stripe'])
            hline(a, 0, T - 1, 0, hi)
            hline(a, 0, T - 1, hgt - 1, dk)
    elif style == 'wood':
        for x in (7, 19):
            vline(a, x, 1, hgt - 2, dk)
        hline(a, 0, T - 1, 3, shade(fl, 0.9))
    return a


def edge_bottom(P, rng):
    a = new(T, T)
    c = P.get('trim', shade(P['fill'], 1.5))
    rect(a, 0, T - 4, T, 4, c)
    hline(a, 0, T - 1, T - 4, shade(c, 1.2))
    hline(a, 0, T - 1, T - 1, shade(c, 0.55))
    hline(a, 0, T - 1, T - 5, shade(P['fill'], 0.7))
    for x in (5, 17):
        put(a, x, T - 2, shade(c, 0.6))
    return a


def edge_side(P, rng, left=True):
    """墙体侧面（left=True 表示空气在左侧）。"""
    a = new(T, T)
    c = P.get('trim', shade(P['fill'], 1.5))
    rect(a, 0, 0, 4, T, c)
    vline(a, 0, 0, T - 1, shade(c, 1.25))
    vline(a, 3, 0, T - 1, shade(c, 0.6))
    vline(a, 4, 0, T - 1, shade(P['fill'], 0.7))
    for y in (5, 17):
        put(a, 1, y, shade(c, 0.6))
    return a if left else flip_h(a)


def platform(P, rng):
    """单向平台三段：左端 / 中段 / 右端（只占图块上部）。"""
    c = P['plat']
    hi = shade(c, 1.3)
    dk = shade(c, 0.6)
    style = P.get('plat_style', 'shelf')
    parts = []
    for part in ('l', 'm', 'r'):
        a = new(T, T)
        rect(a, 0, 0, T, 5, c)
        hline(a, 0, T - 1, 0, hi)
        hline(a, 0, T - 1, 4, dk)
        hline(a, 0, T - 1, 5, (20, 16, 26, 255))
        if style == 'shelf':
            # 木搁板 + 金属托架
            for x in (5, 12, 19):
                put(a, x, 2, dk)
            if part in ('l', 'r'):
                bx = 3 if part == 'l' else T - 5
                bc = P.get('bracket', (90, 96, 110, 255))
                vline(a, bx, 6, 11, bc)
                vline(a, bx + 1, 6, 9, shade(bc, 0.7))
                line(a, bx, 11, bx + (5 if part == 'l' else -5), 6, bc)
        elif style == 'catwalk':
            for x in range(2, T, 4):
                put(a, x, 2, dk)
                put(a, x + 1, 2, hi)
            if part in ('l', 'r'):
                bx = 2 if part == 'l' else T - 4
                rect(a, bx, 6, 2, 3, dk)
        elif style == 'pipe':
            hline(a, 0, T - 1, 1, hi)
            hline(a, 0, T - 1, 3, dk)
            for x in (6, 18):
                vline(a, x, 0, 4, dk)
        elif style == 'energy':
            g = P.get('glow', (120, 240, 220, 255))
            hline(a, 2, T - 3, 2, g)
            for x in (0, T - 1):
                vline(a, x, 0, 4, dk)
        if part == 'l':
            vline(a, 0, 0, 5, (20, 16, 26, 255))
        if part == 'r':
            vline(a, T - 1, 0, 5, (20, 16, 26, 255))
        parts.append(a)
    return parts


def spikes(P, rng):
    """地刺：占图块下半部。"""
    a = new(T, T)
    c = P.get('spike', (200, 205, 215, 255))
    dk = shade(c, 0.55)
    hi = shade(c, 1.25)
    for i in range(4):
        x = i * 6
        hgt = 9 + (i % 2) * 2
        poly(a, [(x, T), (x + 3, T - hgt), (x + 6, T)], c)
        line(a, x + 3, T - hgt, x + 5, T - 1, dk)
        line(a, x + 3, T - hgt, x + 1, T - 1, hi)
        put(a, x + 3, T - hgt, (255, 255, 255, 255))
    hline(a, 0, T - 1, T - 1, dk)
    return a


def back_wall(P, rng, n=4):
    out = {}
    style = P.get('wall_style', 'plaster')
    wc = P['wall']
    dk = shade(wc, 0.86)
    lt = shade(wc, 1.08)
    plains = []
    for v in range(n):
        a = new(T, T)
        rect(a, 0, 0, T, T, wc)
        if style == 'plaster':
            speckle(a, rng, [dk, lt], 10)
            if v == 1:
                line(a, 5, 3, 9, 9, dk)      # 墙皮裂纹
                line(a, 9, 9, 8, 14, dk)
            if v == 2:
                rect(a, 14, 6, 5, 4, shade(wc, 0.93))
        elif style == 'panel':
            frame(a, 0, 0, T, T, dk)
            hline(a, 1, T - 2, 1, lt)
            vline(a, 1, 1, T - 2, lt)
            for (x, y) in ((3, 3), (T - 4, 3), (3, T - 4), (T - 4, T - 4)):
                put(a, x, y, dk)
            if v == 1:
                rect(a, 8, 10, 8, 4, shade(wc, 0.8))
                hline(a, 9, 14, 11, P.get('glow', lt))
            if v == 2:
                for y in (8, 11, 14):
                    hline(a, 6, 17, y, dk)
        elif style == 'brick':
            for row in range(3):
                y = row * 8
                hline(a, 0, T - 1, y + 7, dk)
                off = 0 if row % 2 == 0 else 6
                for x in (off + 5, off + 17):
                    vline(a, x % T, y, y + 6, dk)
                for x in range(0, T, 12):
                    if rng.random() < 0.3:
                        rect(a, (x + off + 6) % T, y + 1, 5, 5, lt if rng.random() < 0.5 else shade(wc, 0.92))
            speckle(a, rng, [dk], 6)
        elif style == 'hex':
            frame(a, 0, 0, T, T, dk)
            g = P.get('glow', lt)
            if v == 0:
                hline(a, 0, T - 1, 12, shade(wc, 0.9))
            if v == 1:
                rect(a, 4, 4, T - 8, T - 8, shade(wc, 0.9))
                frame(a, 4, 4, T - 8, T - 8, dk)
            if v == 2:
                hline(a, 3, T - 4, T - 3, mix(wc, g, 0.45))
            if v == 3:
                vline(a, 12, 0, T - 1, dk)
                put(a, 12, 12, mix(wc, g, 0.7))
        elif style == 'wallpaper':
            for y in range(0, T, 6):
                for x in range((y // 6 % 2) * 3, T, 6):
                    put(a, x, y + 2, lt)
            vline(a, 0, 0, T - 1, shade(wc, 0.95))
        a = noise_shade(a, rng, 2)
        plains.append(a)
    out['back'] = plains
    # 墙裙（靠近地面的两格）
    if 'dado' in P:
        dc = P['dado']
        d1 = new(T, T)
        rect(d1, 0, 0, T, T, dc)
        speckle(d1, rng, [shade(dc, 0.9), shade(dc, 1.08)], 10)
        d1 = noise_shade(d1, rng, 2)
        d2 = d1.copy()   # 墙裙顶沿
        rect(d2, 0, 0, T, 9, wc)
        speckle(d2, rng, [dk, lt], 4, 0, 0, T, 8)
        hline(d2, 0, T - 1, 9, shade(dc, 1.25))
        hline(d2, 0, T - 1, 10, shade(dc, 0.7))
        d3 = d1.copy()   # 踢脚线
        rect(d3, 0, T - 4, T, 4, shade(dc, 0.62))
        hline(d3, 0, T - 1, T - 4, shade(dc, 0.8))
        out['dado'] = [d1]
        out['dado_top'] = [d2]
        out['dado_base'] = [d3]
    return out


# ---------------------------------------------------------------- 各实验区配色

BIOMES = {
    # 力学实验楼：老式教学楼——白墙、绿墙裙、水磨石地面、木搁板
    'mech': dict(
        fill=(64, 60, 70, 255), fill_style='block', trim=(118, 112, 116, 255),
        floor=(160, 158, 150, 255), floor_style='terrazzo', fleck=(176, 132, 104, 255),
        plat=(150, 104, 66, 255), plat_style='shelf',
        wall=(206, 200, 178, 255), wall_style='plaster', dado=(84, 136, 112, 255),
        spike=(196, 204, 214, 255),
    ),
    # 电磁实验室：深蓝金属壁板、防静电地板、青色指示灯
    'em': dict(
        fill=(38, 40, 60, 255), fill_style='panel', trim=(96, 104, 136, 255),
        floor=(118, 126, 150, 255), floor_style='metal', glow=(110, 230, 255, 255),
        plat=(104, 112, 140, 255), plat_style='catwalk',
        wall=(74, 82, 112, 255), wall_style='panel',
        spike=(170, 190, 230, 255),
    ),
    # 热学车间：红砖、铸铁格栅、管道
    'thermo': dict(
        fill=(52, 38, 40, 255), fill_style='brick', trim=(124, 92, 78, 255),
        floor=(112, 100, 98, 255), floor_style='grate',
        plat=(132, 110, 96, 255), plat_style='pipe',
        wall=(128, 80, 66, 255), wall_style='brick',
        spike=(214, 190, 170, 255),
    ),
    # 量子对撞机：深青色蜂巢壁板、白陶瓷地面、警示条纹
    'quantum': dict(
        fill=(24, 32, 44, 255), fill_style='plate', trim=(70, 110, 120, 255),
        floor=(176, 186, 196, 255), floor_style='ceramic', stripe=(232, 190, 60, 255),
        plat=(60, 96, 110, 255), plat_style='energy', glow=(110, 245, 215, 255),
        wall=(40, 70, 80, 255), wall_style='hex',
        spike=(150, 240, 220, 255),
    ),
    # 茶水间：米色墙纸、木墙裙、木地板
    'rest': dict(
        fill=(58, 48, 46, 255), fill_style='block', trim=(120, 96, 78, 255),
        floor=(168, 122, 82, 255), floor_style='wood',
        plat=(150, 104, 66, 255), plat_style='shelf',
        wall=(214, 196, 164, 255), wall_style='wallpaper', dado=(142, 100, 70, 255),
        spike=(196, 204, 214, 255),
    ),
}


def register(atlas):
    for name, P in BIOMES.items():
        rng = rng_for(name)
        pre = f't/{name}/'
        for i, a in enumerate(fill_tiles(P, rng)):
            atlas.add(f'{pre}fill/{i}', Sprite(a), trim=False)
        for v in range(2):
            atlas.add(f'{pre}edge_t/{v}', Sprite(edge_top(P, rng, v)), trim=False)
        atlas.add(f'{pre}edge_b', Sprite(edge_bottom(P, rng)), trim=False)
        atlas.add(f'{pre}edge_l', Sprite(edge_side(P, rng, True)), trim=False)
        atlas.add(f'{pre}edge_r', Sprite(edge_side(P, rng, False)), trim=False)
        for part, a in zip('lmr', platform(P, rng)):
            atlas.add(f'{pre}plat/{part}', Sprite(a), trim=False)
        atlas.add(f'{pre}spike', Sprite(spikes(P, rng)), trim=False)
        for key, lst in back_wall(P, rng).items():
            for i, a in enumerate(lst):
                atlas.add(f'{pre}{key}/{i}', Sprite(a), trim=False)


if __name__ == '__main__':
    import sys
    from px import Atlas, preview
    at = Atlas()
    register(at)
    # 拼一个小场景预览每个区域
    scenes = []
    for name in BIOMES:
        g = {k[len(f't/{name}/'):]: s.arr for k, s in at.items if k.startswith(f't/{name}/')}
        W, H = 12, 7
        sc = new(W * T, H * T)
        solid = [[False] * W for _ in range(H)]
        for x in range(W):
            solid[H - 1][x] = True
            solid[0][x] = x < 3 or x > 8
        for y in range(H):
            solid[y][0] = True
        solid[H - 2][W - 1] = solid[H - 2][W - 2] = solid[H - 3][W - 1] = True
        for y in range(H):
            for x in range(W):
                if solid[y][x]:
                    blit(sc, g[f'fill/{(x * 7 + y * 3) % 4}'], x * T, y * T)
                else:
                    below = 0
                    while y + below + 1 < H and not solid[y + below + 1][x]:
                        below += 1
                    key = f'back/{(x * 5 + y * 3) % 4}'
                    if 'dado/0' in g:
                        key = 'dado_base/0' if below == 0 else ('dado_top/0' if below == 1 else key)
                    blit(sc, g[key], x * T, y * T)
        for y in range(H):
            for x in range(W):
                if not solid[y][x]:
                    continue
                if y + 1 < H and not solid[y + 1][x]:
                    blit(sc, g['edge_b'], x * T, y * T)
                if x > 0 and not solid[y][x - 1]:
                    blit(sc, g['edge_l'], x * T, y * T)
                if x + 1 < W and not solid[y][x + 1]:
                    blit(sc, g['edge_r'], x * T, y * T)
                if y > 0 and not solid[y - 1][x]:
                    blit(sc, g[f'edge_t/{x % 2}'], x * T, y * T)
        for i, part in enumerate('lmmr'):
            blit(sc, g[f'plat/{part}'], (4 + i) * T, 3 * T)
        blit(sc, g['spike'], 7 * T, (H - 2) * T)
        blit(sc, g['spike'], 8 * T, (H - 2) * T)
        scenes.append(Sprite(sc))
    print(preview(scenes, sys.argv[1], zoom=3, cols=1))
