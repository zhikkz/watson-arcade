"""场景摆设（纯装饰，画在背景墙前、角色后）。命名：prop/<name>

为了和可交互物件区分，摆设用更柔和的描边并整体略微压暗。
"""
import math
import numpy as np
from px import (new, rect, hline, vline, put, line, ellipse, ring, poly, shade, mix, ball, block, tube,
                Sprite, outline_outer, tint)
from gen_items import pxtext, C, K, WHITE, STEEL, STEEL_D, STEEL_L, BRASS, WOOD

SOFT = (44, 40, 58)
P = {}


def prop(name, w, h, depth=0.1):
    def deco(fn):
        a = new(w + 2, h + 2)
        fn(a)
        a = outline_outer(a, SOFT)
        a = tint(a, (40, 40, 70), depth)
        P['prop/' + name] = Sprite(a, 0, 0)
        return fn
    return deco


def legs(a, x0, x1, y0, y1, col):
    for x in (x0, x1):
        rect(a, x, y0, 2, y1 - y0 + 1, col)


# ---------------------------------------------------------------- 通用
@prop('lamp', 22, 9, 0)
def _(a):
    vline(a, 6, 1, 3, C(80, 84, 100))
    vline(a, 17, 1, 3, C(80, 84, 100))
    block(a, 2, 3, 20, 3, C(150, 156, 176))
    rect(a, 3, 6, 18, 3, C(255, 250, 230))
    hline(a, 3, 20, 8, C(255, 232, 180))


@prop('boxes', 30, 26)
def _(a):
    for (x, y, w, h, c) in ((1, 13, 15, 14, C(190, 146, 90)), (15, 15, 15, 12, C(176, 132, 80)), (7, 1, 16, 13, C(200, 158, 100))):
        block(a, x, y, w, h, c)
        rect(a, x + w // 2 - 1, y, 3, h, C(226, 206, 160))
        hline(a, x, x + w - 1, y + 3, shade(c, 0.8))


@prop('clock', 16, 16)
def _(a):
    ball(a, 9, 9, 7.5, 7.5, C(236, 236, 228), spec=False)
    ring(a, 9, 9, 7.5, 7.5, C(110, 100, 96), 1.4)
    line(a, 9, 9, 9, 4, K)
    line(a, 9, 9, 12, 10, K)
    put(a, 9, 9, C(200, 60, 60))


@prop('window', 48, 44, 0)
def _(a):
    block(a, 1, 1, 48, 44, C(170, 160, 150))
    rect(a, 4, 4, 42, 38, C(26, 34, 70))
    rect(a, 4, 4, 42, 14, C(40, 52, 100))
    rect(a, 4, 30, 42, 12, C(20, 26, 54))
    ball(a, 34, 13, 5, 5, C(240, 240, 220), spec=False)
    ellipse(a, 36, 11, 4, 4, C(40, 52, 100))
    for x, y in ((9, 8), (15, 14), (22, 7), (27, 20), (41, 24), (11, 24), (19, 28)):
        put(a, x, y, WHITE)
    # 远处楼房
    for x, w, h in ((6, 8, 9), (16, 6, 13), (24, 10, 7), (36, 8, 11)):
        rect(a, x, 42 - h, w, h, C(14, 18, 40))
        put(a, x + 2, 42 - h + 3, C(255, 220, 120))
    rect(a, 24, 4, 2, 38, C(170, 160, 150))
    rect(a, 4, 22, 42, 2, C(170, 160, 150))


@prop('poster1', 24, 28)
def _(a):
    block(a, 1, 1, 24, 28, C(236, 228, 204))
    pxtext(a, 3, 3, 'F=ma', C(180, 60, 50), 8)
    ball(a, 13, 16, 3, 3, C(214, 70, 60))
    put(a, 13, 12, C(90, 150, 70))
    for y in (21, 23, 25):
        vline(a, 13, y, y, C(120, 120, 130))
    hline(a, 4, 21, 27, C(150, 140, 120))


@prop('poster2', 26, 30)
def _(a):
    block(a, 1, 1, 26, 30, C(232, 236, 240))
    cols = [C(230, 110, 100), C(240, 190, 90), C(120, 200, 130), C(110, 160, 230), C(180, 140, 220)]
    for r in range(6):
        for c in range(7):
            if r == 0 and 0 < c < 6:
                continue
            if r in (1, 2) and 1 < c < 5:
                continue
            rect(a, 3 + c * 3, 6 + r * 3, 2, 2, cols[(c + r) % 5])
    hline(a, 3, 23, 3, C(90, 96, 120))
    hline(a, 3, 23, 27, C(160, 166, 180))


@prop('doorframe', 56, 82, 0)
def _(a):
    c, hi, lo = C(122, 128, 150), C(176, 182, 204), C(78, 82, 104)
    rect(a, 1, 1, 56, 8, c)
    hline(a, 1, 56, 1, hi)
    hline(a, 1, 56, 8, lo)
    for x in (1, 52):
        rect(a, x, 9, 5, 74, c)
        vline(a, x, 9, 82, hi)
        vline(a, x + 4, 9, 82, lo)
        for y in (16, 40, 64):
            put(a, x + 2, y, lo)
    rect(a, 23, 3, 12, 4, C(40, 60, 50))
    rect(a, 24, 4, 10, 2, C(123, 255, 160))


# ---------------------------------------------------------------- 力学实验楼
@prop('bench_mech', 56, 30)
def _(a):
    block(a, 1, 12, 56, 5, C(170, 124, 78))
    legs(a, 4, 52, 17, 30, C(120, 86, 54))
    rect(a, 8, 20, 42, 2, C(120, 86, 54))
    # 铁架台 + 单摆
    rect(a, 8, 10, 10, 2, STEEL_D)
    vline(a, 10, 0, 10, STEEL)
    hline(a, 10, 20, 1, STEEL)
    line(a, 19, 1, 23, 8, C(210, 210, 220))
    ball(a, 23, 9, 2, 2, BRASS, spec=False)
    # 天平
    vline(a, 40, 3, 11, STEEL)
    hline(a, 33, 47, 4, STEEL)
    for x in (33, 47):
        vline(a, x, 4, 8, C(170, 170, 180))
        hline(a, x - 3, x + 3, 9, BRASS)
    rect(a, 37, 11, 7, 1, STEEL_D)


@prop('cabinet', 28, 46)
def _(a):
    block(a, 1, 1, 28, 46, C(140, 150, 170))
    for dx in (3, 15):
        rect(a, dx, 4, 11, 30, C(60, 76, 96))
        rect(a, dx + 1, 5, 9, 28, C(108, 140, 160))
        for sy in (13, 22):
            hline(a, dx + 1, dx + 9, sy, C(60, 76, 96))
    for x, y, c in ((5, 9, C(214, 90, 80)), (8, 8, C(240, 200, 100)), (18, 10, C(120, 200, 140)), (22, 9, C(230, 230, 240)),
                    (6, 18, C(110, 160, 230)), (19, 18, C(200, 150, 230)), (9, 27, C(240, 200, 100)), (21, 27, C(214, 90, 80))):
        rect(a, x, y, 2, 4, c)
    rect(a, 3, 36, 23, 8, C(120, 130, 150))
    put(a, 13, 40, K)
    put(a, 16, 40, K)


@prop('cradle', 28, 24)
def _(a):
    block(a, 1, 21, 28, 4, C(120, 86, 54))
    for x in (3, 26):
        vline(a, x, 2, 21, STEEL)
    hline(a, 3, 26, 2, STEEL_L)
    for i in range(5):
        x = 8 + i * 3 + (-4 if i == 0 else 0)
        line(a, 9 + i * 3, 3, x, 15 if i else 13, C(200, 200, 210))
        ball(a, x, 17 if i else 15, 2, 2, STEEL_L, spec=False)


@prop('stool', 14, 16)
def _(a):
    ball(a, 8, 4, 6.5, 2.6, C(120, 86, 54), spec=False)
    hline(a, 3, 12, 3, C(170, 124, 78))
    vline(a, 4, 6, 16, STEEL_D)
    vline(a, 11, 6, 16, STEEL_D)
    hline(a, 4, 11, 11, STEEL_D)


@prop('globe', 16, 24)
def _(a):
    ball(a, 9, 9, 7, 7, C(90, 150, 210))
    for x, y in ((6, 6), (7, 7), (8, 6), (11, 9), (10, 11), (12, 10), (6, 11)):
        put(a, x, y, C(120, 190, 120))
    ring(a, 9, 9, 8, 8, BRASS, 1)
    vline(a, 9, 17, 22, BRASS)
    rect(a, 4, 22, 11, 3, C(120, 86, 54))


@prop('extinguisher', 10, 20)
def _(a):
    rect(a, 2, 6, 8, 15, C(206, 60, 54))
    vline(a, 3, 7, 19, C(240, 110, 100))
    rect(a, 4, 3, 4, 3, STEEL_D)
    hline(a, 2, 9, 2, K)
    rect(a, 3, 11, 6, 3, C(240, 232, 210))


@prop('weights', 26, 12)
def _(a):
    block(a, 1, 9, 26, 4, C(120, 86, 54))
    for x, w, h in ((3, 7, 8), (11, 6, 6), (18, 4, 5), (23, 3, 3)):
        poly(a, [(x + 1, 9 - h), (x + w - 1, 9 - h), (x + w, 9), (x, 9)], BRASS)
        rect(a, x + w // 2 - 1, 9 - h - 2, 2, 2, shade(BRASS, 1.2))


@prop('incline', 46, 24)
def _(a):
    poly(a, [(1, 24), (45, 24), (45, 6)], C(170, 124, 78))
    line(a, 1, 23, 45, 5, C(214, 170, 110))
    hline(a, 1, 45, 24, C(120, 86, 54))
    ring(a, 43, 5, 3, 3, STEEL, 1)
    # 斜面上的小车
    block(a, 20, 9, 9, 5, C(206, 70, 60))
    put(a, 21, 15, K)
    put(a, 27, 13, K)
    line(a, 29, 10, 41, 5, C(220, 220, 230))


@prop('blackboard', 64, 40)
def _(a):
    block(a, 1, 1, 64, 40, C(150, 104, 66))
    rect(a, 4, 4, 58, 31, C(38, 78, 62))
    pxtext(a, 7, 5, 'E=mc', C(240, 240, 230), 10)
    put(a, 33, 6, C(240, 240, 230))
    put(a, 34, 7, C(240, 240, 230))
    put(a, 33, 8, C(240, 240, 230))
    put(a, 34, 8, C(240, 240, 230))
    pxtext(a, 7, 15, 'PV=nRT', C(255, 233, 160), 10)
    pxtext(a, 7, 24, 'λ=h/p', C(190, 232, 255), 10)
    ring(a, 51, 22, 6, 6, C(255, 160, 170))
    line(a, 46, 17, 56, 27, C(240, 240, 230))
    rect(a, 8, 36, 6, 2, WHITE)
    rect(a, 18, 36, 5, 2, C(255, 233, 160))


@prop('pulley', 22, 30)
def _(a):
    rect(a, 9, 1, 4, 3, STEEL_D)
    ball(a, 11, 8, 5, 5, STEEL, spec=False)
    ring(a, 11, 8, 5, 5, STEEL_D, 1.2)
    put(a, 11, 8, K)
    vline(a, 6, 8, 24, C(214, 200, 170))
    vline(a, 16, 8, 16, C(214, 200, 170))
    poly(a, [(4, 24), (9, 24), (10, 30), (3, 30)], BRASS)
    block(a, 14, 16, 5, 5, C(110, 116, 140))


@prop('shelf', 40, 18)
def _(a):
    block(a, 1, 14, 40, 3, C(150, 104, 66))
    for x, w, h, c in ((3, 3, 10, C(206, 90, 80)), (6, 3, 12, C(90, 130, 200)), (9, 4, 9, C(230, 200, 110)), (13, 3, 11, C(120, 180, 130))):
        block(a, x, 14 - h, w, h, c)
    # 烧杯
    rect(a, 22, 8, 6, 6, C(200, 230, 240))
    rect(a, 23, 11, 4, 3, C(120, 200, 230))
    rect(a, 31, 6, 4, 8, C(200, 230, 240))
    rect(a, 31, 10, 4, 4, C(230, 150, 200))
    hline(a, 30, 35, 5, C(200, 230, 240))


# ---------------------------------------------------------------- 电磁实验室
@prop('bench_em', 56, 30)
def _(a):
    block(a, 1, 12, 56, 4, C(120, 128, 152))
    legs(a, 4, 52, 16, 30, C(80, 86, 110))
    rect(a, 8, 22, 42, 2, C(80, 86, 110))
    block(a, 6, 1, 16, 11, C(180, 176, 160))
    rect(a, 8, 3, 9, 7, C(18, 52, 40))
    for k in range(9):
        put(a, 8 + k, 6 + round(math.sin(k * 0.9) * 2), C(110, 255, 130))
    put(a, 19, 4, K)
    put(a, 19, 8, C(224, 70, 60))
    block(a, 28, 5, 9, 7, C(230, 190, 60))
    rect(a, 30, 6, 5, 3, C(40, 50, 40))
    line(a, 37, 9, 44, 11, C(224, 70, 60))
    line(a, 36, 10, 47, 11, K)
    ball(a, 49, 9, 3, 3, C(190, 110, 60), spec=False)


@prop('rack', 26, 46)
def _(a):
    block(a, 1, 1, 26, 46, C(60, 64, 86))
    for r in range(7):
        y = 4 + r * 6
        rect(a, 4, y, 20, 4, C(34, 36, 52))
        for c in range(5):
            put(a, 6 + c * 3, y + 1, [C(123, 224, 123), C(98, 230, 255), C(255, 210, 74), C(60, 80, 70)][(r * 3 + c * 5) % 4])
        hline(a, 6, 20, y + 3, C(80, 86, 110))


@prop('vdg', 22, 42)
def _(a):
    block(a, 5, 36, 14, 7, C(80, 86, 110))
    rect(a, 9, 16, 6, 20, C(200, 220, 230))
    vline(a, 10, 16, 35, WHITE)
    for y in range(18, 36, 4):
        hline(a, 9, 14, y, C(150, 170, 190))
    ball(a, 12, 9, 9, 9, STEEL_L)
    put(a, 2, 4, WHITE)
    put(a, 22, 6, WHITE)


@prop('coilbig', 26, 46)
def _(a):
    poly(a, [(3, 46), (25, 46), (21, 38), (7, 38)], C(80, 86, 110))
    rect(a, 9, 12, 10, 26, C(204, 122, 66))
    for y in range(13, 38, 3):
        hline(a, 9, 18, y, C(130, 76, 40))
    vline(a, 9, 12, 37, C(240, 170, 110))
    ball(a, 14, 8, 12, 5.5, C(196, 180, 250))


@prop('console', 42, 28)
def _(a):
    poly(a, [(1, 28), (41, 28), (41, 14), (34, 8), (6, 8), (1, 14)], C(86, 94, 124))
    rect(a, 7, 1, 13, 9, C(40, 46, 66))
    rect(a, 8, 2, 11, 7, C(20, 60, 70))
    for k in range(4):
        hline(a, 9, 11 + (k * 3) % 6, 3 + k, C(98, 230, 255))
    rect(a, 23, 2, 12, 8, C(40, 46, 66))
    rect(a, 24, 3, 10, 6, C(30, 50, 40))
    for k in range(8):
        put(a, 25 + k, 6 + round(math.sin(k) * 1.5), C(123, 224, 123))
    for i in range(8):
        put(a, 5 + i * 4, 15, [C(224, 70, 60), C(255, 210, 74), C(123, 224, 123)][i % 3])
        put(a, 6 + i * 4, 18, C(190, 196, 214))
    rect(a, 4, 22, 34, 1, C(60, 66, 90))


@prop('magnet', 24, 24)
def _(a):
    rect(a, 2, 21, 20, 3, C(80, 86, 110))
    ring(a, 12, 11, 9, 9, C(214, 62, 62), 4)
    rect(a, 0, 11, 24, 12, (0, 0, 0, 0))
    rect(a, 3, 11, 4, 8, C(214, 62, 62))
    rect(a, 17, 11, 4, 8, C(64, 110, 220))
    b = new(26, 26)
    ring(b, 12, 11, 9, 9, C(64, 110, 220), 4)
    m = b[..., 3] > 0
    m[11:, :] = False
    m[:, :12] = False
    a[m] = b[m]
    rect(a, 3, 17, 4, 3, WHITE)
    rect(a, 17, 17, 4, 3, WHITE)
    rect(a, 2, 21, 20, 3, C(80, 86, 110))


@prop('warn_elec', 16, 16, 0.05)
def _(a):
    poly(a, [(8.5, 1), (16, 15), (1, 15)], C(240, 200, 50))
    poly(a, [(9, 5), (6, 10), (8, 10), (7, 14), (11, 8), (9, 8), (10, 5)], K)


@prop('scope_wall', 24, 18, 0.05)
def _(a):
    block(a, 1, 1, 24, 18, C(60, 64, 86))
    rect(a, 3, 3, 20, 13, C(16, 46, 36))
    for k in range(18):
        put(a, 4 + k, 9 + round(math.sin(k * 0.7) * 4), C(110, 255, 130))
    hline(a, 3, 22, 9, C(30, 80, 60))


@prop('cables', 42, 20)
def _(a):
    for i, col in enumerate((C(60, 60, 80), C(180, 60, 60), C(60, 110, 190))):
        for x in range(42):
            y = 3 + i * 3 + round(math.sin(x / 41 * math.pi) * (9 + i * 2))
            put(a, x + 1, y, col)
            put(a, x + 1, y + 1, shade(col, 0.7))
    rect(a, 1, 1, 3, 5, STEEL_D)
    rect(a, 40, 1, 3, 5, STEEL_D)


@prop('poster3', 20, 28)
def _(a):
    block(a, 1, 1, 20, 28, C(220, 232, 240))
    for (x0, y0, x1, y1) in ((4, 6, 16, 6), (16, 6, 16, 20), (16, 20, 4, 20), (4, 20, 4, 6)):
        line(a, x0, y0, x1, y1, C(40, 70, 130))
    rect(a, 8, 5, 4, 3, C(220, 232, 240))
    for k in range(4):
        put(a, 8 + k, 6 + (k % 2), C(40, 70, 130))
    rect(a, 15, 11, 3, 4, C(220, 232, 240))
    hline(a, 14, 18, 12, C(40, 70, 130))
    hline(a, 15, 17, 14, C(40, 70, 130))
    ring(a, 4.5, 13.5, 2.5, 2.5, C(200, 60, 60), 1)
    hline(a, 5, 15, 24, C(150, 160, 170))


@prop('fusebox', 18, 24)
def _(a):
    block(a, 1, 1, 18, 24, C(150, 156, 172))
    rect(a, 3, 3, 14, 12, C(110, 116, 136))
    for i in range(4):
        rect(a, 4 + i * 3, 5, 2, 6, C(40, 44, 60))
        rect(a, 4 + i * 3, 5 + (3 if i == 2 else 0), 2, 3, C(224, 70, 60) if i == 2 else C(123, 224, 123))
    poly(a, [(9.5, 17), (13, 23), (6, 23)], C(240, 200, 50))


# ---------------------------------------------------------------- 热学车间
@prop('boiler', 34, 46)
def _(a):
    ellipse(a, 18, 8, 15, 7, C(150, 96, 70))
    rect(a, 3, 8, 30, 32, C(150, 96, 70))
    rect(a, 27, 8, 6, 32, C(110, 68, 50))
    rect(a, 4, 8, 3, 31, C(196, 136, 100))
    for y in (14, 26, 38):
        hline(a, 3, 32, y, C(96, 60, 46))
        for x in range(6, 32, 5):
            put(a, x, y - 1, C(214, 160, 120))
    ball(a, 17, 20, 4.5, 4.5, WHITE, spec=False)
    ring(a, 17, 20, 4.5, 4.5, K, 1)
    line(a, 17, 20, 19, 18, C(220, 60, 60))
    rect(a, 9, 30, 12, 7, K)
    rect(a, 10, 31, 10, 5, C(255, 150, 60))
    hline(a, 10, 19, 33, C(255, 220, 120))
    legs(a, 6, 28, 40, 46, C(70, 60, 60))


@prop('dewar', 18, 30)
def _(a):
    ellipse(a, 10, 6, 7, 4, C(214, 224, 236))
    rect(a, 3, 6, 14, 22, C(214, 224, 236))
    rect(a, 14, 6, 3, 22, C(160, 172, 192))
    vline(a, 4, 6, 27, WHITE)
    rect(a, 7, 1, 6, 3, STEEL_D)
    rect(a, 5, 13, 9, 6, C(70, 130, 220))
    pxtext(a, 6, 12, 'N', WHITE, 8)
    for x, y in ((3, 26), (6, 28), (12, 27), (16, 25), (9, 29)):
        put(a, x, y, WHITE)
    hline(a, 3, 16, 29, C(120, 130, 150))


@prop('furnace', 36, 36)
def _(a):
    block(a, 1, 1, 36, 36, C(136, 84, 66))
    for r in range(6):
        y = 2 + r * 6
        hline(a, 2, 35, y + 5, C(96, 58, 46))
        for x in range(4 if r % 2 else 10, 36, 12):
            vline(a, x, y, y + 4, C(96, 58, 46))
    rect(a, 9, 14, 18, 16, K)
    rect(a, 10, 15, 16, 14, C(60, 30, 20))
    ellipse(a, 18, 26, 7, 4, C(255, 130, 50))
    ellipse(a, 18, 27, 4, 2.4, C(255, 220, 120))
    for x in (12, 15, 18, 21, 24):
        vline(a, x, 15, 28, C(40, 30, 30))


@prop('barrel', 18, 24)
def _(a):
    rect(a, 2, 2, 15, 22, C(170, 80, 56))
    rect(a, 14, 2, 3, 22, C(120, 54, 40))
    vline(a, 3, 2, 23, C(214, 120, 90))
    for y in (2, 9, 16, 23):
        hline(a, 1, 17, y, C(110, 50, 38))
    rect(a, 6, 11, 7, 4, C(240, 200, 50))


@prop('valve', 20, 22)
def _(a):
    rect(a, 8, 8, 5, 15, C(110, 104, 110))
    vline(a, 9, 8, 22, C(170, 164, 170))
    rect(a, 6, 12, 9, 3, C(80, 76, 84))
    ring(a, 10.5, 5, 6, 4, C(206, 60, 54), 1.6)
    hline(a, 5, 15, 5, C(206, 60, 54))
    vline(a, 10, 1, 8, C(206, 60, 54))


@prop('pipes', 50, 20)
def _(a):
    for y, col in ((2, C(140, 100, 80)), (10, C(110, 116, 130))):
        rect(a, 1, y, 50, 6, col)
        hline(a, 1, 50, y + 1, shade(col, 1.3))
        hline(a, 1, 50, y + 5, shade(col, 0.65))
        for x in (10, 30, 44):
            rect(a, x, y - 1, 3, 8, shade(col, 0.8))
    rect(a, 20, 16, 3, 5, C(110, 116, 130))
    ring(a, 21.5, 17, 3, 3, C(206, 60, 54), 1)


@prop('gauge', 14, 14, 0.05)
def _(a):
    ball(a, 8, 8, 6.5, 6.5, C(240, 240, 232), spec=False)
    ring(a, 8, 8, 6.5, 6.5, BRASS, 1.4)
    line(a, 8, 8, 11, 5, C(220, 60, 60))
    for x, y in ((4, 8), (5, 5), (8, 4), (11, 8)):
        put(a, x, y, K)


@prop('warn_hot', 16, 16, 0.05)
def _(a):
    poly(a, [(8.5, 1), (16, 15), (1, 15)], C(240, 200, 50))
    poly(a, [(8, 5), (6, 10), (7, 13), (10, 13), (11, 10), (9, 8), (9, 5)], C(214, 60, 40))


@prop('thermo', 8, 26, 0.05)
def _(a):
    block(a, 1, 1, 8, 26, C(232, 228, 214))
    vline(a, 4, 4, 20, C(190, 190, 190))
    vline(a, 4, 10, 20, C(220, 60, 60))
    ball(a, 4.5, 22, 2, 2, C(220, 60, 60), spec=False)
    for y in range(5, 20, 3):
        put(a, 6, y, K)


# ---------------------------------------------------------------- 量子对撞机
@prop('cryostat', 30, 44)
def _(a):
    ellipse(a, 16, 7, 13, 6, C(60, 110, 200))
    rect(a, 3, 7, 26, 32, C(60, 110, 200))
    rect(a, 24, 7, 5, 32, C(40, 76, 150))
    rect(a, 4, 7, 3, 31, C(120, 170, 240))
    for y in (13, 33):
        rect(a, 3, y, 26, 2, C(190, 196, 214))
    rect(a, 10, 18, 11, 10, C(230, 236, 246))
    pxtext(a, 12, 19, 'He', C(40, 76, 150), 8)
    rect(a, 12, 0, 8, 3, STEEL_D)
    legs(a, 6, 24, 39, 44, C(70, 76, 100))
    put(a, 26, 37, C(123, 255, 216))


@prop('detector', 48, 48, 0.05)
def _(a):
    cx = cy = 25
    pts = [(cx + math.cos(k / 8 * math.tau + 0.39) * 23, cy + math.sin(k / 8 * math.tau + 0.39) * 23) for k in range(8)]
    poly(a, pts, C(70, 90, 110))
    for r, col in ((19, C(200, 110, 60)), (15, C(90, 120, 150)), (11, C(190, 180, 90)), (7, C(60, 100, 130))):
        ball(a, cx, cy, r, r, col, spec=False)
    ball(a, cx, cy, 3, 3, C(184, 255, 240), spec=False)
    for k in range(12):
        ang = k / 12 * math.tau
        line(a, cx + math.cos(ang) * 4, cy + math.sin(ang) * 4, cx + math.cos(ang) * 19, cy + math.sin(ang) * 19, C(40, 56, 72))
    rect(a, 8, 44, 34, 5, C(60, 70, 90))


@prop('hazbarrel', 18, 24)
def _(a):
    rect(a, 2, 2, 15, 22, C(232, 196, 60))
    rect(a, 14, 2, 3, 22, C(176, 140, 40))
    vline(a, 3, 2, 23, C(250, 230, 130))
    for y in (2, 9, 16, 23):
        hline(a, 1, 17, y, C(120, 96, 30))
    ball(a, 9, 12.5, 3, 3, K, spec=False)
    put(a, 9, 12, C(232, 196, 60))


@prop('warn_rad', 16, 16, 0.05)
def _(a):
    ball(a, 8.5, 8.5, 7.5, 7.5, C(240, 200, 50), spec=False)
    for k in range(3):
        ang = k / 3 * math.tau - 1.57
        poly(a, [(8.5 + math.cos(ang - 0.45) * 6.5, 8.5 + math.sin(ang - 0.45) * 6.5), (8.5 + math.cos(ang + 0.45) * 6.5, 8.5 + math.sin(ang + 0.45) * 6.5), (8.5, 8.5)], K)
    ball(a, 8.5, 8.5, 2.2, 2.2, C(240, 200, 50), spec=False)
    put(a, 8, 8, K)


@prop('screen', 30, 20, 0.05)
def _(a):
    block(a, 1, 1, 30, 20, C(50, 60, 80))
    rect(a, 3, 3, 26, 15, C(10, 26, 36))
    rng = np.random.default_rng(3)
    for k in range(9):
        ang = rng.uniform(0, math.tau)
        col = [C(123, 255, 216), C(255, 210, 74), C(255, 122, 217)][k % 3]
        x, y = 16.0, 10.0
        for s in range(12):
            ang += rng.uniform(-0.25, 0.25) + (0.12 if k % 2 else -0.12)
            x += math.cos(ang) * 1.1
            y += math.sin(ang) * 0.8
            if 3 <= x < 29 and 3 <= y < 18:
                put(a, int(x), int(y), col)
    put(a, 16, 10, WHITE)


@prop('ring', 46, 16, 0.05)
def _(a):
    rect(a, 1, 4, 46, 9, C(60, 110, 200))
    hline(a, 1, 46, 5, C(120, 170, 240))
    hline(a, 1, 46, 12, C(40, 76, 150))
    for x in (8, 22, 36):
        rect(a, x, 2, 4, 13, C(190, 196, 214))
        vline(a, x, 2, 14, WHITE)
    rect(a, 13, 7, 7, 3, C(184, 255, 240))
    rect(a, 27, 7, 7, 3, C(184, 255, 240))


# ---------------------------------------------------------------- 茶水间
@prop('sofa', 48, 26)
def _(a):
    block(a, 1, 4, 48, 14, C(150, 90, 80))
    block(a, 1, 14, 48, 9, C(176, 110, 96))
    for x in (1, 42):
        block(a, x, 9, 7, 14, C(140, 84, 74))
    vline(a, 25, 15, 21, C(130, 78, 70))
    legs(a, 4, 43, 23, 26, C(80, 60, 50))
    block(a, 10, 8, 9, 7, C(240, 210, 120))


@prop('plant', 16, 32)
def _(a):
    poly(a, [(4, 22), (13, 22), (12, 32), (5, 32)], C(190, 110, 80))
    hline(a, 3, 14, 22, C(214, 140, 100))
    for (x0, y0, x1, y1) in ((8, 22, 3, 8), (8, 22, 8, 2), (9, 22, 14, 7), (8, 22, 1, 15), (9, 22, 16, 14)):
        line(a, x0, y0, x1, y1, C(70, 150, 90), 2)
        put(a, x1, y1, C(130, 210, 140))


@prop('fridge', 24, 44)
def _(a):
    block(a, 1, 1, 24, 44, C(226, 232, 238))
    hline(a, 1, 24, 15, C(150, 156, 170))
    rect(a, 20, 5, 2, 7, C(150, 156, 170))
    rect(a, 20, 19, 2, 10, C(150, 156, 170))
    rect(a, 5, 20, 5, 5, C(255, 233, 160))
    rect(a, 12, 23, 4, 4, C(255, 150, 160))
    put(a, 7, 19, C(224, 70, 60))
    put(a, 13, 22, C(70, 130, 230))
    rect(a, 1, 42, 24, 3, C(170, 176, 190))


def register(atlas):
    for name, spr in P.items():
        atlas.add(name, spr, trim=True)
    return P


if __name__ == '__main__':
    import sys
    from px import preview
    items = list(P.values())
    small = [s for s in items if s.h <= 30 and s.w <= 30]
    big = [s for s in items if not (s.h <= 30 and s.w <= 30)]
    print(preview(small, sys.argv[1] + '_small.png', zoom=4, cols=10))
    print(preview(big, sys.argv[1] + '_big.png', zoom=3, cols=8))
