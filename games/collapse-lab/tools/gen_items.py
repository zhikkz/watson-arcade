"""装备 / 图标 / 交互物件 / 投射物的像素美术。

  wpn/<id>    手持武器（朝右，锚点在握把处）
  item/<id>   16x16 图标（锚点在底边中点）
  perk/<id>   定理徽章
  ui/*  obj/*  proj/*  fx/coin/*
"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from px import (new, rect, hline, vline, put, line, ellipse, ring, poly, shade, mix, ball, block, tube, finish,
                Sprite, outline_outer, OUTLINE, flip_h)

K = (20, 16, 26, 255)
WHITE = (255, 255, 255, 255)
HERE = os.path.dirname(os.path.abspath(__file__))
_fonts = {}


def C(r, g, b):
    return (r, g, b, 255)


def pxtext(a, x, y, text, color, size=8):
    """用像素字体把文字画进数组（y 为字形顶端）。"""
    if size not in _fonts:
        p = os.path.join(HERE, '..', 'node_modules', '@fontsource', f'fusion-pixel-{size}px-proportional-sc', 'files',
                         f'fusion-pixel-{size}px-proportional-sc-latin-400-normal.woff')
        _fonts[size] = ImageFont.truetype(p, size)
    f = _fonts[size]
    top = {8: 2, 10: 4, 12: 4}[size]
    w = int(f.getlength(text)) + 4
    im = Image.new('L', (w, size + 12), 0)
    d = ImageDraw.Draw(im)
    d.fontmode = '1'
    d.text((0, 0), text, font=f, fill=255)
    m = np.array(im) > 0
    for yy in range(size + 2):
        for xx in range(w):
            if m[top + yy, xx]:
                put(a, x + xx, y + yy, color)
    return w - 4


STEEL, STEEL_D, STEEL_L = C(186, 194, 212), C(120, 128, 150), C(236, 240, 250)
BRASS, WOOD = C(208, 166, 76), C(160, 112, 66)


# ---------------------------------------------------------------- 手持武器
def weapons():
    out = {}
    # 活动扳手
    a = new(22, 11)
    rect(a, 1, 4, 13, 3, STEEL)
    hline(a, 1, 13, 4, STEEL_L)
    hline(a, 1, 13, 6, STEEL_D)
    rect(a, 1, 4, 4, 3, C(200, 70, 60))
    rect(a, 13, 2, 7, 7, STEEL)
    rect(a, 16, 4, 4, 3, (0, 0, 0, 0))
    hline(a, 13, 19, 2, STEEL_L)
    hline(a, 13, 19, 8, STEEL_D)
    out['wpn/wrench'] = finish(a, 3, 5)
    # 游标卡尺
    a = new(26, 11)
    rect(a, 1, 4, 22, 2, STEEL_L)
    hline(a, 1, 22, 5, STEEL_D)
    for x in range(6, 22, 2):
        put(a, x, 4, STEEL_D)
    rect(a, 1, 3, 5, 4, C(70, 74, 96))
    rect(a, 21, 2, 2, 8, STEEL)
    rect(a, 15, 3, 3, 7, STEEL)
    put(a, 16, 5, C(220, 70, 70))
    out['wpn/caliper'] = finish(a, 3, 5)
    # 傅科摆锤
    a = new(32, 17)
    rect(a, 1, 7, 20, 2, C(120, 96, 80))
    hline(a, 1, 20, 7, C(170, 140, 110))
    rect(a, 1, 6, 5, 4, C(70, 60, 60))
    ball(a, 24, 8, 7, 7, BRASS)
    ring(a, 24, 8, 4.2, 4.2, shade(BRASS, 0.7))
    out['wpn/pendulum'] = finish(a, 3, 8)
    # 激光教鞭（光刃由代码绘制）
    a = new(12, 6)
    rect(a, 1, 2, 8, 2, C(60, 62, 84))
    hline(a, 1, 8, 2, C(110, 112, 140))
    rect(a, 9, 2, 2, 2, C(255, 90, 106))
    put(a, 4, 2, C(255, 210, 90))
    out['wpn/pointer'] = finish(a, 3, 3)
    # 音叉
    a = new(26, 11)
    rect(a, 1, 5, 9, 1, STEEL)
    ball(a, 2, 5.5, 1.8, 1.8, STEEL, spec=False)
    rect(a, 10, 2, 14, 2, STEEL)
    rect(a, 10, 7, 14, 2, STEEL)
    rect(a, 9, 2, 2, 7, STEEL)
    hline(a, 10, 23, 2, STEEL_L)
    hline(a, 10, 23, 8, STEEL_D)
    out['wpn/fork'] = finish(a, 3, 5)
    # 电磁轨道炮
    a = new(28, 13)
    block(a, 1, 3, 11, 7, C(96, 76, 150))
    rect(a, 3, 9, 4, 4, C(60, 50, 90))
    rect(a, 12, 3, 14, 2, STEEL)
    rect(a, 12, 8, 14, 2, STEEL)
    rect(a, 12, 5, 11, 3, C(190, 150, 255))
    hline(a, 12, 22, 6, WHITE)
    put(a, 5, 5, C(255, 220, 90))
    out['wpn/railgun'] = finish(a, 4, 7)
    # 激光笔
    a = new(11, 6)
    rect(a, 1, 2, 7, 2, C(226, 228, 236))
    hline(a, 1, 7, 3, C(160, 164, 180))
    rect(a, 8, 2, 2, 2, C(255, 74, 90))
    put(a, 3, 2, C(255, 74, 90))
    out['wpn/laserpen'] = finish(a, 3, 3)
    # 液氮喷枪
    a = new(22, 13)
    ball(a, 5, 6, 4.5, 5, C(220, 236, 250))
    rect(a, 3, 10, 4, 3, C(70, 80, 110))
    rect(a, 9, 5, 9, 2, STEEL)
    hline(a, 9, 17, 5, STEEL_L)
    poly(a, [(18, 3), (21, 2), (21, 10), (18, 9)], STEEL_D)
    put(a, 5, 3, C(120, 200, 255))
    out['wpn/cryo'] = finish(a, 5, 8)
    # 阴极射线管
    a = new(24, 12)
    rect(a, 1, 4, 5, 4, C(70, 70, 90))
    ellipse(a, 13, 6, 8, 4.5, C(150, 230, 170))
    ellipse(a, 12.5, 5.5, 6.5, 3.2, C(210, 255, 220))
    hline(a, 6, 16, 6, C(60, 140, 90))
    rect(a, 20, 4, 3, 4, STEEL)
    out['wpn/cathode'] = finish(a, 3, 6)
    # 占位：莱顿瓶 / 飞盘 / 拳套在手上不显示独立精灵
    for n in ('leyden', 'gyro', 'gloves'):
        b = new(3, 3)
        put(b, 1, 1, (0, 0, 0, 1))
        out['wpn/' + n] = Sprite(b, 1, 1)
    return out


# ---------------------------------------------------------------- 投射物
def projectiles():
    out = {}
    # 莱顿瓶
    a = new(12, 15)
    rect(a, 3, 5, 6, 8, C(170, 210, 240))
    rect(a, 3, 9, 6, 4, STEEL)
    vline(a, 3, 5, 12, C(230, 245, 255))
    rect(a, 5, 2, 2, 4, STEEL_D)
    ball(a, 6, 2, 2, 2, BRASS, spec=False)
    out['proj/jar'] = finish(a, 6, 8)
    # 干冰
    a = new(12, 12)
    block(a, 2, 2, 8, 8, C(226, 244, 255))
    put(a, 4, 4, WHITE)
    put(a, 7, 7, C(160, 210, 240))
    out['proj/dryice'] = finish(a, 6, 6)
    # 引力阱
    a = new(12, 12)
    ball(a, 6, 6, 4, 4, C(40, 24, 60), hi=C(200, 140, 255))
    ring(a, 6, 6, 5, 5, C(200, 140, 255))
    out['proj/gwell'] = Sprite(a, 6, 6)
    # 猫箱
    a = new(14, 14)
    block(a, 2, 3, 10, 9, C(190, 142, 86))
    hline(a, 2, 11, 6, C(140, 100, 60))
    pxtext(a, 5, 4, '?', K, 8)
    out['proj/catbox'] = finish(a, 7, 7)
    out['obj/catbox'] = finish(a.copy(), 7, 12)
    # 反物质胶囊
    a = new(12, 10)
    ellipse(a, 6, 5, 5, 3.5, C(255, 122, 217))
    rect(a, 6, 2, 5, 6, (0, 0, 0, 0))
    b = new(12, 10)
    ellipse(b, 6, 5, 5, 3.5, WHITE)
    m = b[..., 3] > 0
    m[:, :6] = False
    a[m] = b[m]
    put(a, 3, 4, WHITE)
    out['proj/bomb'] = finish(a, 6, 5)
    return out


# ---------------------------------------------------------------- 16x16 图标
def icon(draw):
    a = new(18, 18)
    draw(a)
    return finish(a, 9, 17)


def icons():
    out = {}

    def wrench(a):
        line(a, 4, 14, 10, 8, STEEL, 2)
        rect(a, 10, 3, 5, 5, STEEL)
        rect(a, 12, 3, 2, 2, (0, 0, 0, 0))
        put(a, 4, 15, C(200, 70, 60))
        put(a, 5, 14, C(200, 70, 60))

    def caliper(a):
        line(a, 3, 14, 14, 3, STEEL_L, 2)
        line(a, 12, 2, 15, 5, STEEL, 2)
        line(a, 8, 6, 11, 9, STEEL, 2)
        put(a, 4, 14, C(70, 74, 96))

    def pendulum(a):
        line(a, 4, 3, 9, 9, C(150, 124, 100), 2)
        ball(a, 11, 11, 4.5, 4.5, BRASS)

    def pointer(a):
        line(a, 3, 14, 7, 10, C(70, 72, 96), 2)
        line(a, 8, 9, 14, 3, C(255, 90, 106), 2)
        line(a, 8, 8, 14, 2, WHITE, 1)

    def fork(a):
        line(a, 3, 14, 7, 10, STEEL, 1)
        line(a, 6, 9, 12, 3, STEEL_L, 1)
        line(a, 9, 12, 15, 6, STEEL_L, 1)
        line(a, 6, 9, 9, 12, STEEL, 1)
        put(a, 13, 2, C(159, 232, 255))
        put(a, 15, 4, C(159, 232, 255))

    def gloves(a):
        block(a, 4, 6, 9, 8, C(240, 214, 70))
        rect(a, 4, 12, 9, 3, C(120, 110, 150))
        for x in (6, 8, 10):
            vline(a, x, 6, 8, C(190, 160, 40))
        poly(a, [(11, 1), (8, 6), (10, 6), (8, 10), (13, 4), (11, 4), (13, 1)], C(190, 240, 255))

    def laserpen(a):
        line(a, 3, 13, 8, 8, C(226, 228, 236), 2)
        put(a, 9, 7, C(255, 74, 90))
        for k in range(3):
            put(a, 11 + k * 2, 5 - k * 2, C(255, 74, 90))
        put(a, 15, 1, WHITE)

    def leyden(a):
        rect(a, 5, 6, 8, 9, C(170, 210, 240))
        rect(a, 5, 10, 8, 5, STEEL)
        vline(a, 5, 6, 14, C(230, 245, 255))
        rect(a, 8, 3, 2, 4, STEEL_D)
        ball(a, 9, 3, 2.2, 2.2, BRASS, spec=False)
        put(a, 14, 4, C(190, 240, 255))
        put(a, 3, 7, C(190, 240, 255))

    def railgun(a):
        block(a, 2, 6, 6, 6, C(96, 76, 150))
        rect(a, 3, 11, 3, 4, C(60, 50, 90))
        rect(a, 8, 6, 8, 2, STEEL)
        rect(a, 8, 10, 8, 2, STEEL)
        rect(a, 8, 8, 6, 2, C(190, 150, 255))

    def gyro(a):
        ball(a, 9, 9, 6, 6, C(255, 210, 74))
        ring(a, 9, 9, 3.4, 3.4, C(170, 120, 30))
        put(a, 9, 9, K)
        put(a, 2, 5, WHITE)
        put(a, 3, 3, WHITE)
        put(a, 15, 14, WHITE)

    def cryo(a):
        ball(a, 6, 9, 4, 5, C(220, 236, 250))
        rect(a, 9, 8, 5, 2, STEEL)
        poly(a, [(14, 6), (16, 5), (16, 12), (14, 11)], STEEL_D)
        for x, y in ((12, 3), (14, 2), (16, 3), (14, 4), (14, 3)):
            put(a, x, y, C(143, 220, 255))

    def cathode(a):
        rect(a, 2, 8, 3, 4, C(70, 70, 90))
        ellipse(a, 10, 9, 6, 4, C(150, 230, 170))
        ellipse(a, 9.5, 8.5, 4.5, 2.6, C(210, 255, 220))
        for k in range(3):
            put(a, 15 + (k % 2), 6 + k * 3, C(123, 224, 123))

    def coil(a):
        poly(a, [(4, 16), (14, 16), (12, 12), (6, 12)], C(98, 104, 132))
        rect(a, 7, 5, 4, 7, C(204, 122, 66))
        for y in (6, 8, 10):
            hline(a, 7, 10, y, C(130, 76, 40))
        ball(a, 9, 4, 5, 2.4, C(206, 190, 255))
        put(a, 3, 3, WHITE)
        put(a, 15, 2, WHITE)

    def dryice(a):
        block(a, 4, 5, 9, 9, C(226, 244, 255))
        put(a, 6, 7, WHITE)
        for x, y in ((3, 15), (6, 16), (11, 15), (14, 14), (15, 11)):
            put(a, x, y, C(190, 230, 250))

    def gravity(a):
        ball(a, 9, 9, 4, 4, C(26, 18, 40), hi=C(90, 60, 130))
        ring(a, 9, 9, 6.5, 6.5, C(200, 140, 255))
        for k in range(6):
            ang = k / 6 * math.tau
            put(a, int(9 + math.cos(ang) * 8), int(9 + math.sin(ang) * 8), WHITE)

    def catbox(a):
        block(a, 3, 7, 12, 9, C(190, 142, 86))
        hline(a, 3, 14, 10, C(140, 100, 60))
        poly(a, [(5, 7), (6, 3), (8, 7)], C(64, 54, 100))
        poly(a, [(10, 7), (12, 3), (13, 7)], C(64, 54, 100))
        rect(a, 6, 6, 7, 2, C(64, 54, 100))
        put(a, 7, 6, C(120, 255, 230))
        put(a, 11, 6, C(120, 255, 230))
        pxtext(a, 7, 9, '?', K, 8)

    def wormhole(a):
        ring(a, 6, 9, 4, 6, C(98, 230, 255), 1.4)
        ring(a, 12, 9, 3, 5, C(190, 245, 255), 1.2)
        hline(a, 6, 12, 9, WHITE)

    def antimatter(a):
        ellipse(a, 9, 9, 6, 4, C(255, 122, 217))
        b = new(18, 18)
        ellipse(b, 9, 9, 6, 4, WHITE)
        m = b[..., 3] > 0
        m[:, :9] = False
        a[m] = b[m]
        for x, y in ((3, 3), (15, 3), (2, 14), (16, 14)):
            put(a, x, y, C(255, 154, 228))

    def demon(a):
        ball(a, 9, 10, 5.5, 5, C(150, 118, 176))
        poly(a, [(4, 6), (3, 1), (7, 5)], C(240, 230, 210))
        poly(a, [(11, 5), (15, 1), (14, 6)], C(240, 230, 210))
        rect(a, 6, 9, 2, 2, C(255, 224, 90))
        rect(a, 10, 9, 2, 2, C(255, 224, 90))
        hline(a, 7, 11, 13, K)
        put(a, 2, 13, C(255, 154, 74))
        put(a, 16, 13, C(143, 220, 255))

    for name, fn in dict(wrench=wrench, caliper=caliper, pendulum=pendulum, pointer=pointer, fork=fork, gloves=gloves, laserpen=laserpen,
                         leyden=leyden, railgun=railgun, gyro=gyro, cryo=cryo, cathode=cathode, coil=coil, dryice=dryice, gravity=gravity,
                         catbox=catbox, wormhole=wormhole, antimatter=antimatter, demon=demon).items():
        out['item/' + name] = icon(fn)

    # 保温杯
    def flask(a):
        rect(a, 6, 4, 7, 12, C(176, 186, 204))
        vline(a, 6, 4, 15, C(232, 238, 248))
        vline(a, 12, 4, 15, C(110, 120, 144))
        rect(a, 6, 2, 7, 3, C(60, 64, 84))
        rect(a, 6, 8, 7, 3, C(200, 70, 60))
        put(a, 9, 9, C(255, 220, 90))

    def noodle(a):
        poly(a, [(4, 8), (14, 8), (13, 16), (5, 16)], C(224, 70, 60))
        rect(a, 4, 7, 11, 2, C(250, 240, 220))
        hline(a, 6, 12, 11, C(255, 220, 90))
        for x, y in ((6, 5), (9, 3), (12, 5), (9, 1)):
            put(a, x, y, C(230, 230, 240))

    def scroll(a):
        rect(a, 4, 5, 11, 9, C(246, 234, 200))
        rect(a, 3, 4, 13, 2, C(214, 190, 140))
        rect(a, 3, 13, 13, 2, C(214, 190, 140))
        for y in (7, 9, 11):
            hline(a, 6, 12, y, C(150, 130, 100))
        rect(a, 8, 9, 3, 3, C(220, 70, 70))

    out['item/flask'] = icon(flask)
    out['item/noodle'] = icon(noodle)
    out['item/scroll'] = icon(scroll)
    return out


def ui_icons():
    out = {}
    # 金币
    for i, w in enumerate((5, 3, 1, 3)):
        a = new(9, 9)
        ellipse(a, 4.5, 4.5, w / 2 + 0.3, 3, C(255, 210, 74))
        if w >= 3:
            vline(a, 4, 3, 5, C(190, 140, 40))
        put(a, 4 - w // 2, 3, WHITE)
        out[f'fx/coin/{i}'] = finish(a, 4, 8)
    a = new(12, 12)
    ball(a, 6, 6, 4.5, 4.5, C(255, 210, 74))
    pxtext(a, 4, 2, '¥', C(150, 100, 20), 8)
    out['ui/coin'] = finish(a, 6, 11)
    a = new(12, 12)
    poly(a, [(6, 1), (11, 6), (6, 11), (1, 6)], C(98, 230, 255))
    poly(a, [(6, 3), (9, 6), (6, 9), (3, 6)], C(214, 248, 255))
    out['ui/data'] = finish(a, 6, 11)
    a = new(16, 16)
    ball(a, 5, 6, 3.6, 3.6, C(229, 72, 77))
    ball(a, 10, 6, 3.6, 3.6, C(229, 72, 77))
    poly(a, [(1.5, 7), (13.5, 7), (7.5, 14)], C(229, 72, 77))
    put(a, 4, 4, WHITE)
    out['ui/heart'] = finish(a, 8, 15)
    a = new(18, 18)
    rect(a, 3, 3, 12, 2, WOOD)
    rect(a, 3, 13, 12, 2, WOOD)
    vline(a, 3, 3, 15, shade(WOOD, 0.7))
    vline(a, 14, 3, 15, shade(WOOD, 0.7))
    line(a, 6, 12, 9, 6, STEEL, 1)
    line(a, 10, 12, 12, 6, C(255, 90, 106), 1)
    out['ui/rack'] = finish(a, 9, 17)
    a = new(18, 18)
    ball(a, 9, 10, 6, 5.5, C(232, 152, 72))
    poly(a, [(3, 7), (4, 2), (8, 6)], C(232, 152, 72))
    poly(a, [(10, 6), (14, 2), (15, 7)], C(232, 152, 72))
    rect(a, 6, 9, 2, 2, C(120, 220, 90))
    rect(a, 10, 9, 2, 2, C(120, 220, 90))
    put(a, 9, 12, C(255, 150, 160))
    out['ui/cat'] = finish(a, 9, 17)
    # HUD 保温杯
    for name, body, band in (('on', C(176, 186, 204), C(123, 224, 123)), ('off', C(70, 74, 92), C(50, 54, 70))):
        a = new(11, 15)
        rect(a, 2, 4, 7, 10, body)
        vline(a, 2, 4, 13, shade(body, 1.3))
        rect(a, 2, 2, 7, 3, C(60, 64, 84))
        rect(a, 2, 7, 7, 4, band)
        out['ui/flask_' + name] = finish(a, 5, 14)
    # 文献图标
    for name, col in (('force', C(255, 122, 94)), ('tech', C(181, 140, 255)), ('vital', C(123, 224, 123))):
        a = new(18, 18)
        block(a, 3, 3, 12, 13, col)
        rect(a, 3, 3, 3, 13, shade(col, 0.7))
        rect(a, 7, 6, 6, 1, WHITE)
        rect(a, 7, 9, 6, 1, WHITE)
        rect(a, 7, 12, 4, 1, WHITE)
        out['ui/scroll_' + name] = finish(a, 9, 17)
    return out


PERK_SYMBOLS = {
    'newton3': ('F', (220, 90, 70)), 'conserve': ('E', (90, 190, 110)), 'momentum': ('p', (220, 90, 70)), 'entropy': ('S', (230, 140, 60)),
    'uncertainty': ('Δ', (150, 110, 220)), 'relativity': ('c', (90, 160, 230)), 'photoelectric': ('γ', (230, 200, 70)), 'doppler': ('f', (220, 90, 70)),
    'tunneling': ('ψ', (150, 110, 220)), 'superconduct': ('Ω', (90, 160, 230)), 'emc2': ('m', (230, 200, 70)), 'hooke': ('k', (90, 160, 230)),
    'bernoulli': ('v', (220, 90, 70)), 'kepler': ('T', (90, 200, 220)), 'archimedes': ('ρ', (90, 190, 110)), 'carnot': ('η', (90, 190, 110)),
    'halflife': ('λ', (90, 190, 110)), 'leverage': ('L', (220, 90, 70)), 'pauli': ('↑', (150, 110, 220)), 'resonance': ('ω', (220, 90, 70)),
    'blackbody': ('σ', (230, 140, 60)), 'absolute0': ('0', (120, 200, 240)), 'faraday': ('Φ', (90, 200, 220)), 'chain': ('n', (230, 140, 60)),
}


def perk_icons():
    out = {}
    for pid, (sym, col) in PERK_SYMBOLS.items():
        a = new(20, 20)
        c = (col[0], col[1], col[2], 255)
        ball(a, 10, 10, 8, 8, c, spec=False)
        ring(a, 10, 10, 8, 8, shade(c, 1.35), 1.2)
        tw = int(_font(10).getlength(sym))
        pxtext(a, 10 - tw // 2, 5, sym, WHITE, 10)
        out['perk/' + pid] = finish(a, 10, 19)
    return out


def _font(size):
    if size not in _fonts:
        pxtext(new(2, 2), 0, 0, ' ', K, size)
    return _fonts[size]


# ---------------------------------------------------------------- 交互物件
def objects():
    out = {}
    # 纸箱 / 木箱
    a = new(22, 20)
    block(a, 2, 3, 18, 16, C(196, 150, 92))
    rect(a, 2, 3, 18, 3, C(214, 172, 112))
    rect(a, 9, 3, 4, 16, C(226, 206, 160))
    hline(a, 2, 19, 6, C(150, 108, 64))
    pxtext(a, 4, 9, '↑', C(150, 60, 50), 8)
    out['obj/crate/0'] = finish(a, 11, 19)
    a = new(22, 20)
    block(a, 2, 3, 18, 16, WOOD)
    for x in (2, 18):
        rect(a, x, 3, 2, 16, shade(WOOD, 0.75))
    rect(a, 2, 3, 18, 2, shade(WOOD, 0.75))
    rect(a, 2, 17, 18, 2, shade(WOOD, 0.75))
    line(a, 4, 5, 17, 16, shade(WOOD, 0.75), 1)
    line(a, 17, 5, 4, 16, shade(WOOD, 0.75), 1)
    out['obj/crate/1'] = finish(a, 11, 19)
    a = new(22, 20)
    block(a, 2, 3, 18, 16, C(128, 138, 166))
    rect(a, 2, 3, 18, 3, C(170, 180, 206))
    for x in (3, 18):
        rect(a, x, 7, 1, 11, C(92, 100, 126))
    rect(a, 8, 9, 6, 5, C(232, 190, 60))
    for x, y in ((4, 5), (17, 5), (4, 17), (17, 17)):
        put(a, x, y, C(210, 216, 232))
    out['obj/crate/2'] = finish(a, 11, 19)
    # 样品柜（宝箱）
    for i in range(2):
        a = new(28, 24)
        block(a, 2, 4, 24, 18, C(120, 132, 160))
        rect(a, 2, 4, 24, 3, C(160, 172, 200))
        if i == 0:
            rect(a, 5, 9, 18, 10, C(96, 106, 134))
            rect(a, 13, 12, 3, 4, C(255, 210, 74))
            rect(a, 6, 10, 5, 3, C(255, 210, 74))
            pxtext(a, 7, 9, '!', K, 8)
        else:
            rect(a, 5, 9, 18, 10, K)
            rect(a, 6, 10, 16, 8, C(60, 50, 30))
            for x, y in ((8, 12), (12, 14), (17, 11), (15, 16), (10, 16)):
                put(a, x, y, C(255, 233, 160))
            rect(a, 23, 5, 4, 14, C(150, 162, 190))
        out[f'obj/chest/{i}'] = finish(a, 14, 22)
    # 售货机
    a = new(36, 52)
    block(a, 2, 3, 32, 47, C(58, 108, 168))
    rect(a, 2, 3, 32, 4, C(98, 150, 210))
    rect(a, 5, 9, 18, 26, K)
    rect(a, 6, 10, 16, 24, C(150, 220, 240))
    cans = [C(224, 70, 60), C(255, 210, 74), C(123, 224, 123), C(250, 250, 250), C(255, 150, 60), C(181, 140, 255)]
    for r in range(4):
        hline(a, 6, 21, 15 + r * 6, C(60, 100, 130))
        for c in range(4):
            rect(a, 7 + c * 4, 11 + r * 6, 3, 4, cans[(r * 3 + c) % len(cans)])
    rect(a, 25, 10, 7, 9, C(30, 40, 60))
    rect(a, 26, 11, 5, 3, C(123, 224, 123))
    rect(a, 27, 16, 3, 2, C(200, 204, 214))
    rect(a, 25, 22, 7, 2, K)
    rect(a, 6, 38, 24, 8, C(30, 40, 60))
    rect(a, 7, 39, 22, 6, C(20, 26, 40))
    rect(a, 6, 5, 12, 1, WHITE)
    out['obj/vending'] = finish(a, 18, 50)
    # 出口门：0 关 / 1 开
    for i in range(2):
        a = new(34, 54)
        block(a, 2, 4, 30, 48, C(96, 100, 120))
        rect(a, 5, 9, 24, 43, K)
        if i == 0:
            block(a, 6, 10, 22, 42, C(132, 124, 116))
            rect(a, 8, 13, 18, 14, C(112, 106, 100))
            rect(a, 8, 31, 18, 18, C(112, 106, 100))
            rect(a, 23, 30, 3, 5, C(214, 190, 110))
            rect(a, 13, 5, 8, 3, C(224, 70, 60))
        else:
            rect(a, 6, 10, 22, 42, C(18, 30, 26))
            for k in range(5):
                rect(a, 8 + k * 2, 12 + k * 8, 18 - k * 4, 6, C(40, 90, 70) if k % 2 == 0 else C(60, 130, 96))
            rect(a, 11, 5, 12, 3, C(123, 255, 160))
        out[f'obj/door/{i}'] = finish(a, 17, 52)
    # 饮水机
    a = new(24, 50)
    ball(a, 12, 10, 7, 8, C(110, 190, 250))
    ellipse(a, 10, 8, 3, 4, C(190, 232, 255))
    rect(a, 9, 16, 6, 3, C(110, 190, 250))
    block(a, 4, 19, 16, 29, C(232, 236, 244))
    rect(a, 6, 23, 12, 9, C(196, 202, 216))
    rect(a, 7, 25, 3, 3, C(224, 70, 60))
    rect(a, 14, 25, 3, 3, C(70, 130, 230))
    rect(a, 6, 34, 12, 2, C(150, 156, 172))
    rect(a, 6, 38, 12, 8, C(214, 218, 228))
    out['obj/dispenser'] = finish(a, 12, 48)
    # 黑板
    a = new(68, 46)
    block(a, 2, 2, 64, 40, C(150, 104, 66))
    rect(a, 5, 5, 58, 32, C(38, 78, 62))
    rect(a, 5, 5, 58, 1, C(30, 62, 50))
    pxtext(a, 8, 6, 'F=ma', C(240, 240, 230), 10)
    pxtext(a, 36, 6, 'E=hν', C(255, 233, 160), 10)
    pxtext(a, 8, 16, 'ΔxΔp≥', C(240, 240, 230), 10)
    pxtext(a, 9, 26, 'S=k lnΩ', C(190, 232, 255), 10)
    line(a, 50, 18, 59, 27, C(240, 240, 230), 1)
    line(a, 50, 27, 59, 18, C(240, 240, 230), 1)
    ring(a, 54.5, 22.5, 6, 6, C(255, 150, 160))
    rect(a, 10, 38, 6, 2, WHITE)
    rect(a, 20, 38, 5, 2, C(255, 233, 160))
    out['obj/blackboard'] = finish(a, 34, 44)
    # 终端机
    for i in range(2):
        a = new(28, 42)
        block(a, 3, 2, 22, 18, C(84, 90, 116))
        rect(a, 5, 4, 18, 13, C(14, 34, 44))
        for k, wdt in enumerate((12, 8, 14, 6, 10)):
            if not (i == 1 and k == 4):
                hline(a, 7, 6 + wdt, 6 + k * 2, C(98, 230, 255))
        if i == 1:
            rect(a, 7, 14, 3, 1, WHITE)
        rect(a, 11, 20, 6, 4, C(64, 68, 90))
        block(a, 2, 24, 24, 5, C(104, 110, 136))
        for x in range(4, 24, 3):
            put(a, x, 26, C(190, 196, 214))
        block(a, 6, 29, 16, 11, C(70, 74, 96))
        put(a, 19, 32, C(123, 224, 123))
        out[f'obj/terminal/{i}'] = finish(a, 14, 40)
    # 弹射板：0 常态 1 压缩 2 弹出
    for i, hgt in enumerate((5, 2, 10)):
        a = new(26, 20)
        block(a, 4, 15, 18, 3, C(92, 96, 116))
        for k in range(3):
            y0 = 15 - k * hgt / 3
            line(a, 7, y0, 18, y0 - hgt / 6, shade(STEEL, 0.7))
            line(a, 18, y0 - hgt / 6, 7, y0 - hgt / 3, STEEL)
        block(a, 3, 15 - hgt - 3, 20, 3, C(216, 70, 70))
        out[f'obj/spring/{i}'] = finish(a, 13, 18)
    # 提示贴
    a = new(14, 22)
    vline(a, 6, 10, 20, C(120, 96, 80))
    vline(a, 7, 10, 20, C(90, 70, 60))
    block(a, 2, 2, 10, 9, C(255, 233, 160))
    pxtext(a, 5, 2, '!', C(200, 80, 50), 8)
    out['obj/sign'] = finish(a, 7, 20)
    # 移动平台
    a = new(50, 10)
    block(a, 1, 1, 48, 6, C(138, 147, 176))
    for x in range(3, 46, 8):
        poly(a, [(x, 6), (x + 3, 6), (x + 6, 2), (x + 3, 2)], C(232, 190, 60))
    hline(a, 1, 48, 1, C(214, 220, 240))
    a2 = outline_outer(a)
    out['obj/mover'] = Sprite(a2, 1, 1)
    # 摆锤球
    a = new(22, 22)
    ball(a, 11, 11, 9, 9, BRASS)
    ring(a, 11, 11, 5.5, 5.5, shade(BRASS, 0.72))
    out['obj/bob'] = finish(a, 11, 11)
    # 落锤
    a = new(34, 28)
    block(a, 2, 2, 30, 18, C(138, 132, 144))
    rect(a, 2, 2, 30, 3, C(190, 184, 196))
    for x in range(4, 30, 6):
        poly(a, [(x, 20), (x + 2.5, 25), (x + 5, 20)], C(224, 176, 64))
    pxtext(a, 10, 8, '10t', K, 8)
    out['obj/crusher'] = finish(a, 17, 26)
    # 玩家的小线圈
    a = new(16, 30)
    poly(a, [(3, 28), (13, 28), (11, 23), (5, 23)], C(98, 104, 132))
    rect(a, 6, 9, 4, 14, C(204, 122, 66))
    for y in range(10, 23, 3):
        hline(a, 6, 9, y, C(130, 76, 40))
    ball(a, 8, 7, 5.5, 3, C(206, 190, 255))
    out['obj/coil'] = finish(a, 8, 28)
    # 麦克斯韦妖（随从）
    for i in range(2):
        a = new(20, 18)
        for s in (-1, 1):
            poly(a, [(10 + s * 3, 9), (10 + s * 9, 4 if i == 0 else 9), (10 + s * 7, 11)], C(92, 64, 118))
        ball(a, 10, 9, 5, 5, C(150, 118, 176))
        poly(a, [(6, 5), (5, 1), (9, 5)], C(240, 230, 210))
        poly(a, [(11, 5), (14, 1), (14, 5)], C(240, 230, 210))
        rect(a, 8, 8, 2, 2, C(255, 224, 90))
        rect(a, 12, 8, 2, 2, C(255, 224, 90))
        hline(a, 9, 12, 12, K)
        out[f'obj/demon/{i}'] = finish(a, 10, 9)
    return out


def register(atlas):
    allsp = {}
    for fn in (weapons, projectiles, icons, ui_icons, perk_icons, objects):
        allsp.update(fn())
    for name, spr in allsp.items():
        atlas.add(name, spr)
    return allsp


if __name__ == '__main__':
    import sys
    from px import Atlas, preview
    at = Atlas()
    sp = register(at)
    small = [v for k, v in sp.items() if v.h <= 24 and v.w <= 34]
    big = [v for k, v in sp.items() if not (v.h <= 24 and v.w <= 34)]
    print(preview(small, sys.argv[1] + '_small.png', zoom=4, cols=14))
    print(preview(big, sys.argv[1] + '_big.png', zoom=4, cols=7))
