"""自设计怪物的像素美术（全部由代码绘制）。命名：m/<id>/<anim>/<frame>

所有怪物默认朝右，锚点在脚底中心（飞行怪为身体底部中心）。
"""
import math
import numpy as np
from px import (new, rect, frame as box_frame, hline, vline, put, line, ellipse, ring, poly, shade, mix,
                ball, block, tube, finish, eyes, flip_v, flip_h, Sprite, OUTLINE, outline_outer, recolor, tint)

K = (20, 16, 26, 255)
WHITE = (255, 255, 255, 255)


def C(r, g, b):
    return (r, g, b, 255)


# ---------------------------------------------------------------- 研究僧
def grad():
    out = {}
    W, H, CX, GY = 40, 54, 18, 52
    coat, coat_d = C(226, 230, 238), C(176, 184, 204)
    skin, skin_d = C(170, 192, 162), C(128, 152, 126)
    pants, shoe, hair = C(62, 66, 90), C(86, 64, 52), C(34, 30, 44)

    def body(a, bob, la, lb, arm):
        y0 = GY + bob
        # 腿
        for off, col in ((lb, shade(pants, 0.8)), (la, pants)):
            x = CX - 2 + off
            rect(a, x, GY - 10, 4, 9, col)
            rect(a, x, GY - 2, 5, 2, shoe)
        # 后臂
        if arm == 'walk':
            tube(a, CX + 1, y0 - 27, CX + 8, y0 - 22, 1.6, coat_d)
        # 大褂
        poly(a, [(CX - 6, y0 - 31), (CX + 6, y0 - 31), (CX + 7, y0 - 9), (CX - 8, y0 - 9)], coat)
        rect(a, CX - 7, y0 - 12, 14, 3, coat)
        vline(a, CX + 2, y0 - 30, y0 - 10, coat_d)
        rect(a, CX - 7, y0 - 31, 2, 21, coat_d)
        rect(a, CX - 3, y0 - 21, 4, 4, coat_d)        # 口袋
        put(a, CX - 2, y0 - 22, C(220, 70, 70))        # 口袋里的笔
        put(a, CX - 1, y0 - 22, C(70, 110, 220))
        # 头
        hx, hy = CX + 1, y0 - 39
        ball(a, hx, hy, 7.5, 7.5, skin, lo=skin_d)
        ellipse(a, hx - 1.5, hy - 4, 8, 4.6, hair)     # 乱发
        for sx, sy in ((-7, -6), (-3, -9), (2, -9), (5, -7)):
            put(a, hx + sx, hy + sy, hair)
            put(a, hx + sx, hy + sy - 1, hair)
        rect(a, hx - 8, hy - 3, 3, 6, hair)
        # 眼镜 + 黑眼圈
        rect(a, hx + 1, hy - 1, 4, 4, K)
        rect(a, hx + 2, hy, 2, 2, C(214, 236, 255))
        put(a, hx + 6, hy, K)
        hline(a, hx - 4, hx + 1, hy, K)
        put(a, hx + 3, hy + 3, skin_d)
        hline(a, hx + 3, hx + 5, hy + 5, C(90, 60, 70))   # 嘴
        return y0

    def arm_walk(a, y0, sway):
        tube(a, CX + 2, y0 - 27, CX + 11, y0 - 24 + sway, 1.8, coat)
        ball(a, CX + 13, y0 - 23 + sway, 2, 2, skin, spec=False)

    walks = [(0, -2, 2), (-1, 0, 0), (0, 2, -2), (-1, 0, 0)]
    for i, (bob, la, lb) in enumerate(walks):
        a = new(W, H)
        y0 = body(a, bob, la, lb, 'walk')
        arm_walk(a, y0, [0, 1, 0, -1][i])
        out[f'm/grad/walk/{i}'] = finish(a, CX, GY)
    # 攻击：举尺 -> 劈下 -> 收招
    ruler = C(232, 196, 96)
    for i in range(3):
        a = new(W, H)
        y0 = body(a, [0, 1, 0][i], 0, [0, 2, 1][i], 'atk')
        if i == 0:
            tube(a, CX + 2, y0 - 28, CX + 5, y0 - 38, 1.8, coat)
            line(a, CX + 5, y0 - 40, CX - 3, y0 - 52, ruler, 2)
            ball(a, CX + 5, y0 - 39, 2, 2, skin, spec=False)
        elif i == 1:
            tube(a, CX + 2, y0 - 27, CX + 12, y0 - 23, 1.8, coat)
            line(a, CX + 13, y0 - 23, CX + 21, y0 - 15, ruler, 2)
            put(a, CX + 16, y0 - 21, K)
            put(a, CX + 19, y0 - 18, K)
            ball(a, CX + 13, y0 - 23, 2, 2, skin, spec=False)
        else:
            tube(a, CX + 2, y0 - 27, CX + 9, y0 - 19, 1.8, coat)
            line(a, CX + 10, y0 - 18, CX + 16, y0 - 10, ruler, 2)
            ball(a, CX + 10, y0 - 19, 2, 2, skin, spec=False)
        out[f'm/grad/atk/{i}'] = finish(a, CX, GY)
    return out


# ---------------------------------------------------------------- 弹簧跳跳
def hopper():
    out = {}
    W, H, CX, GY = 26, 44, 13, 42
    steel, red = C(196, 202, 216), C(216, 70, 70)
    for i, hgt in enumerate((12, 6, 20)):
        a = new(W, H)
        block(a, CX - 6, GY - 3, 12, 3, C(92, 96, 116))
        n = 4
        step = hgt / n
        for k in range(n):
            y0 = GY - 3 - k * step
            line(a, CX - 5, y0, CX + 5, y0 - step / 2, shade(steel, 0.7), 1)
            line(a, CX + 5, y0 - step / 2, CX - 5, y0 - step, steel, 1)
            line(a, CX + 5, y0 - step / 2 - 1, CX - 5, y0 - step - 1, steel, 1)
        hy = GY - 3 - hgt - 6
        ball(a, CX, hy, 7, 6.5 if i != 1 else 5.5, red)
        eyes(a, CX - 1, hy - 1, gap=4, angry=True)
        hline(a, CX, CX + 4, hy + 3, K)
        put(a, CX - 1, hy - 8, K)
        put(a, CX - 1, hy - 9, C(255, 220, 90))
        out[f'm/hopper/{i}'] = finish(a, CX, GY)
    return out


# ---------------------------------------------------------------- 砝码兵
def weight():
    out = {}
    W, H, CX, GY = 40, 42, 20, 40
    brass, dk, lt = C(204, 164, 76), C(142, 108, 48), C(244, 214, 130)

    def draw(a, sq, fa, fb, feet=True):
        y0 = GY - 4 + sq
        if feet:
            block(a, CX - 9 + fa, GY - 4, 6, 4, C(70, 64, 60))
            block(a, CX + 3 + fb, GY - 4, 6, 4, C(70, 64, 60))
        w2 = 12 + sq
        poly(a, [(CX - 9 - sq * 0.5, y0 - 22 + sq), (CX + 9 + sq * 0.5, y0 - 22 + sq), (CX + w2, y0), (CX - w2, y0)], brass)
        poly(a, [(CX + 5, y0 - 22 + sq), (CX + 9 + sq * 0.5, y0 - 22 + sq), (CX + w2, y0), (CX + 7, y0)], dk)
        poly(a, [(CX - 7, y0 - 21 + sq), (CX - 4, y0 - 21 + sq), (CX - 6, y0 - 1), (CX - 10, y0 - 1)], lt)
        hline(a, CX - w2 + 1, CX + w2 - 1, y0 - 1, dk)
        hline(a, CX - w2 + 1, CX + w2 - 1, y0 - 4, dk)
        # 提钮
        block(a, CX - 3, y0 - 27 + sq, 6, 5, brass)
        block(a, CX - 5, y0 - 30 + sq, 10, 3, lt)
        # 怒目
        ey = y0 - 17 + sq
        rect(a, CX - 1, ey, 4, 3, WHITE)
        rect(a, CX + 5, ey, 4, 3, WHITE)
        put(a, CX + 2, ey + 1, K)
        put(a, CX + 8, ey + 1, K)
        line(a, CX - 2, ey - 2, CX + 3, ey, K)
        line(a, CX + 9, ey - 2, CX + 5, ey, K)
        # 刻字 kg
        for dx, dy in ((0, 0), (0, 1), (0, 2), (0, 3), (1, 2), (2, 1), (2, 3), (4, 1), (5, 1), (4, 2), (5, 2), (5, 3), (4, 4), (5, 4), (6, 1)):
            put(a, CX - 2 + dx, y0 - 10 + sq + dy, dk)

    for i, (fa, fb) in enumerate(((-1, 1), (0, 0), (1, -1), (0, 0))):
        a = new(W, H)
        draw(a, 0 if i % 2 == 0 else -1, fa, fb)
        out[f'm/weight/walk/{i}'] = finish(a, CX, GY)
    a = new(W, H)
    draw(a, 3, -1, 1)
    out['m/weight/crouch'] = finish(a, CX, GY)
    a = new(W, H)
    draw(a, -1, 1, -1)
    out['m/weight/air'] = finish(a, CX, GY)
    return out


# ---------------------------------------------------------------- 滑块车
def cart():
    out = {}
    W, H, CX, GY = 48, 30, 22, 28
    wood, wd = C(176, 126, 74), C(126, 86, 50)
    steel = C(170, 178, 196)

    def draw(a, spin, tilt, fast):
        # 车身
        y = GY - 18 + tilt
        block(a, CX - 15, y, 30, 11, wood)
        hline(a, CX - 13, CX + 12, y + 4, wd)
        hline(a, CX - 13, CX + 4, y + 7, wd)
        # 撞角
        poly(a, [(CX + 15, y), (CX + 23, y + 5), (CX + 15, y + 11)], steel)
        line(a, CX + 16, y + 1, CX + 22, y + 5, shade(steel, 1.3))
        # 小旗
        vline(a, CX - 11, y - 9, y, C(80, 80, 96))
        poly(a, [(CX - 10, y - 9), (CX - 4 - (2 if fast else 0), y - 7), (CX - 10, y - 5)], C(220, 70, 70))
        # 眼
        rect(a, CX + 7, y + 2, 4, 4, WHITE)
        put(a, CX + 10, y + 4, K)
        put(a, CX + 9, y + 4, K)
        line(a, CX + 6, y + 1, CX + 11, y + 3, K)
        # 轮
        for wx in (CX - 9, CX + 9):
            ball(a, wx, GY - 4, 4, 4, C(64, 64, 80), spec=False)
            put(a, wx, GY - 4, steel)
            dx, dy = ((2, 0), (0, 2), (-2, 0), (0, -2))[spin % 4]
            put(a, wx + dx, GY - 4 + dy, steel)
        if fast:
            for ly in (y + 2, y + 6, y + 9):
                hline(a, CX - 23, CX - 18, ly, C(230, 230, 240))

    for i in range(2):
        a = new(W, H)
        draw(a, i, 0, False)
        out[f'm/cart/idle/{i}'] = finish(a, CX, GY)
    for i in range(2):
        a = new(W, H)
        draw(a, i * 2 + 1, 1, True)
        out[f'm/cart/charge/{i}'] = finish(a, CX, GY)
    return out


# ---------------------------------------------------------------- 摆锤蝠
def bat():
    out = {}
    W, H, CX = 40, 30, 20
    steel = C(126, 136, 168)
    wing, rib = C(78, 56, 104), C(132, 100, 160)

    def body(a, cy, open_eyes=True):
        ball(a, CX, cy, 7, 7, steel)
        ring(a, CX, cy - 8, 2.5, 2.5, C(190, 196, 210))
        if open_eyes:
            rect(a, CX - 4, cy - 2, 3, 2, C(255, 214, 80))
            rect(a, CX + 2, cy - 2, 3, 2, C(255, 214, 80))
            put(a, CX - 2, cy - 1, K)
            put(a, CX + 3, cy - 1, K)
        else:
            hline(a, CX - 4, CX - 2, cy - 1, K)
            hline(a, CX + 2, CX + 4, cy - 1, K)
        put(a, CX - 1, cy + 3, WHITE)
        put(a, CX + 1, cy + 3, WHITE)

    for i, lift in enumerate((-8, -2, 5)):
        a = new(W, H)
        cy = 17
        for s in (-1, 1):
            tip = (CX + s * 18, cy + lift)
            mid = (CX + s * 11, cy + lift * 0.4 - 3)
            poly(a, [(CX + s * 5, cy - 3), mid, tip, (CX + s * 13, cy + 4 + lift * 0.3), (CX + s * 8, cy + 3), (CX + s * 5, cy + 3)], wing)
            line(a, CX + s * 5, cy - 2, tip[0], tip[1], rib)
            line(a, CX + s * 6, cy, CX + s * 13, cy + 3 + lift * 0.3, rib)
        body(a, cy)
        out[f'm/bat/fly/{i}'] = finish(a, CX, 25)
    # 倒挂：锚点在顶部（天花板）
    a = new(W, H)
    cy = 12
    vline(a, CX, 0, 3, C(190, 196, 210))
    body(a, cy, open_eyes=False)
    for s in (-1, 1):
        poly(a, [(CX + s * 3, cy - 6), (CX + s * 9, cy - 2), (CX + s * 8, cy + 8), (CX + s * 2, cy + 9)], wing)
        line(a, CX + s * 8, cy - 2, CX + s * 7, cy + 7, rib)
    out['m/bat/hang'] = finish(a, CX, 0)
    return out


# ---------------------------------------------------------------- 静电球
def orb():
    out = {}
    W, H, CX, CY = 40, 40, 20, 20
    chrome = C(204, 210, 226)
    rng = np.random.default_rng(5)
    for i in range(3):
        a = new(W, H)
        for k in range(11):
            ang = k / 11 * math.tau + i * 0.19
            r0, r1 = 9, 13 + rng.integers(0, 6)
            mx = CX + math.cos(ang) * (r0 + 3) + rng.integers(-1, 2)
            my = CY + math.sin(ang) * (r0 + 3) + rng.integers(-1, 2)
            line(a, CX + math.cos(ang) * r0, CY + math.sin(ang) * r0, mx, my, C(150, 220, 255))
            line(a, mx, my, CX + math.cos(ang) * r1, CY + math.sin(ang) * r1, WHITE)
        ball(a, CX, CY, 9, 9, chrome)
        eyes(a, CX - 3, CY - 2, gap=5, angry=True)
        for dx, dy in ((-2, 0), (-1, 1), (0, 0), (1, 1), (2, 0), (3, 1)):
            put(a, CX + dx, CY + 4 + dy, K)
        s = finish(a, CX, CY + 9, outline=False)
        # 只给球体描边，电火花不描
        b = new(W, H)
        ball(b, CX, CY, 9, 9, chrome)
        ob = outline_outer(b)
        edge = (ob[..., 3] > 0) & (b[..., 3] == 0)
        s.arr[edge] = ob[edge]
        out[f'm/orb/{i}'] = s
    return out


# ---------------------------------------------------------------- 特斯拉塔
def tesla():
    out = {}
    W, H, CX, GY = 30, 42, 15, 40
    metal, copper = C(98, 104, 132), C(204, 122, 66)

    def draw(a, glow, spark):
        poly(a, [(CX - 9, GY), (CX + 9, GY), (CX + 6, GY - 8), (CX - 6, GY - 8)], metal)
        hline(a, CX - 5, CX + 5, GY - 8, shade(metal, 1.3))
        rect(a, CX - 2, GY - 5, 4, 3, C(255, 80, 70) if glow else C(120, 40, 46))
        rect(a, CX - 4, GY - 26, 8, 18, copper)
        for y in range(GY - 25, GY - 8, 3):
            hline(a, CX - 4, CX + 3, y, shade(copper, 0.65))
        vline(a, CX - 4, GY - 26, GY - 9, shade(copper, 1.3))
        ball(a, CX, GY - 30, 9, 4.5, C(250, 250, 255) if glow else C(196, 202, 220))
        if spark:
            for dx, dy in ((-11, -34), (10, -36), (0, -38), (-6, -37), (7, -32)):
                put(a, CX + dx, GY + dy, WHITE)
        if glow:
            for dx, dy in ((-12, -30), (12, -31), (-9, -36), (9, -36), (0, -37), (-13, -27), (13, -27)):
                put(a, CX + dx, GY + dy, C(190, 230, 255))
                put(a, CX + dx, GY + dy - 1, WHITE)

    frames = {'idle/0': (False, False), 'idle/1': (False, True), 'charge/0': (True, False), 'charge/1': (True, True)}
    for name, (g, s) in frames.items():
        a = new(W, H)
        draw(a, g, s)
        spr = finish(a, CX, GY)
        out[f'm/tesla/{name}'] = spr
        out[f'm/teslac/{name}'] = Sprite(flip_v(spr.arr), spr.ax, spr.arr.shape[0] - 1 - spr.ay)
    return out


# ---------------------------------------------------------------- 磁铁蟹
def crab():
    out = {}
    W, H, CX, GY = 48, 36, 24, 34
    red, blue, shell = C(214, 62, 62), C(64, 110, 220), C(96, 100, 124)

    def claw(a, s, col, openness, forward):
        # s=-1 后钳（蓝），s=1 前钳（红）
        bx = CX + s * 9
        tx = CX + s * (15 + openness) + forward
        ty = GY - 22 - openness
        tube(a, bx, GY - 10, tx, ty + 6, 2.6, col)
        tube(a, tx, ty + 6, tx + s * -4 + forward, ty, 2.4, col)
        rect(a, int(tx + s * -6 + forward), int(ty - 2), 4, 4, WHITE)

    def draw(a, lp, openness=0, forward=0, glow=False):
        for s in (-1, 1):
            for k in range(3):
                x0 = CX + s * (4 + k * 3)
                off = ((lp + k) % 2) * 2 - 1
                line(a, x0, GY - 6, x0 + s * 4, GY - 3 + off, K, 1)
                line(a, x0 + s * 4, GY - 3 + off, x0 + s * 5, GY, K, 1)
        claw(a, -1, blue, openness, forward)
        ball(a, CX, GY - 8, 10, 6, shell)
        hline(a, CX - 7, CX + 7, GY - 5, shade(shell, 0.7))
        claw(a, 1, red, openness, forward)
        for ex in (CX + 1, CX + 6):
            vline(a, ex, GY - 17, GY - 13, shell)
            rect(a, ex - 1, GY - 19, 3, 3, WHITE)
            put(a, ex + 1, GY - 18, K)
        if glow:
            for k in range(3):
                yy = GY - 26 - k * 3
                hline(a, CX - 12 + k * 2, CX + 12 - k * 2, yy, C(255, 255, 255) if k == 1 else C(200, 170, 255))

    for i in range(4):
        a = new(W, H)
        draw(a, i)
        out[f'm/crab/walk/{i}'] = finish(a, CX, GY)
    for i in range(2):
        a = new(W, H)
        draw(a, 0, openness=3, glow=True if i else False)
        s = finish(a, CX, GY)
        out[f'm/crab/pull/{i}'] = s
    for i, fw in enumerate((0, 6)):
        a = new(W, H)
        draw(a, 0, openness=-3 if i else 2, forward=fw)
        out[f'm/crab/pinch/{i}'] = finish(a, CX, GY)
    return out


# ---------------------------------------------------------------- 示波器
def scope():
    out = {}
    W, H, CX, GY = 34, 42, 16, 40
    case = C(190, 186, 170)

    def draw(a, lp, wave, flash):
        la, lb = ((-2, 2), (0, 0), (2, -2), (0, 0))[lp]
        for off in (la - 4, lb + 3):
            vline(a, CX + off, GY - 9, GY - 2, C(70, 70, 86))
            vline(a, CX + off + 1, GY - 9, GY - 2, C(110, 110, 130))
            rect(a, CX + off - 1, GY - 2, 5, 2, C(60, 60, 76))
        bob = -1 if lp % 2 else 0
        y = GY - 31 + bob
        block(a, CX - 11, y, 22, 22, case)
        rect(a, CX - 9, y + 3, 14, 13, K)
        rect(a, CX - 8, y + 4, 12, 11, C(230, 255, 230) if flash else C(18, 52, 40))
        for gx in range(CX - 8, CX + 4, 3):
            vline(a, gx, y + 4, y + 14, C(30, 80, 60) if not flash else C(200, 240, 200))
        col = C(40, 120, 60) if flash else C(110, 255, 130)
        for k in range(12):
            wy = y + 9 + round(math.sin((k + wave * 2) * 0.9) * 3.4)
            put(a, CX - 8 + k, wy, col)
            put(a, CX - 8 + k, wy + 1, shade(col, 0.6))
        # 旋钮与指示灯
        ball(a, CX + 8, y + 5, 1.8, 1.8, C(60, 60, 76), spec=False)
        ball(a, CX + 8, y + 10, 1.8, 1.8, C(60, 60, 76), spec=False)
        put(a, CX + 8, y + 15, C(255, 80, 70))
        hline(a, CX - 8, CX + 5, y + 18, shade(case, 0.7))
        # 提手 + 探头线
        hline(a, CX - 5, CX + 5, y - 3, C(70, 70, 86))
        vline(a, CX - 5, y - 3, y - 1, C(70, 70, 86))
        vline(a, CX + 5, y - 3, y - 1, C(70, 70, 86))
        line(a, CX + 11, y + 13, CX + 15, y + 10, K)
        rect(a, CX + 14, y + 8, 3, 3, C(255, 220, 90) if flash else C(150, 150, 170))

    for i in range(4):
        a = new(W, H)
        draw(a, i, i, False)
        out[f'm/scope/walk/{i}'] = finish(a, CX, GY)
    for i in range(2):
        a = new(W, H)
        draw(a, 1, i, i == 1)
        out[f'm/scope/shoot/{i}'] = finish(a, CX, GY)
    return out


# ---------------------------------------------------------------- 光子哨兵
def sentinel():
    out = {}
    W, H, CX, CY = 34, 34, 17, 16
    glass, gl_l, gl_d = C(168, 226, 240), C(230, 250, 255), C(96, 168, 200)

    def draw(a, hot, tw):
        pts = [(CX, CY - 13), (CX + 13, CY + 10), (CX - 13, CY + 10)]
        poly(a, pts, glass)
        poly(a, [(CX, CY - 13), (CX, CY + 10), (CX - 13, CY + 10)], gl_l)
        poly(a, [(CX + 4, CY - 5), (CX + 13, CY + 10), (CX + 5, CY + 10)], gl_d)
        ball(a, CX, CY + 2, 4.5, 4.5, C(255, 240, 240) if hot else WHITE, spec=False)
        rect(a, CX, CY + 1, 3, 3, C(255, 60, 60) if hot else K)
        put(a, CX + 1, CY + 1, WHITE)
        # 色散光
        for k, col in enumerate((C(255, 80, 80), C(255, 200, 80), C(120, 240, 120), C(100, 160, 255))):
            put(a, CX + 15 + (tw + k) % 2, CY + 3 + k * 2, col)
            put(a, CX + 16, CY + 4 + k * 2, col)
        put(a, CX - 6, CY + 4, WHITE)
        put(a, CX - 3 + tw, CY - 6, WHITE)

    for i in range(2):
        a = new(W, H)
        draw(a, False, i)
        out[f'm/sentinel/idle/{i}'] = finish(a, CX, CY + 11)
    a = new(W, H)
    draw(a, True, 0)
    out['m/sentinel/charge'] = finish(a, CX, CY + 11)
    return out


# ---------------------------------------------------------------- 冻冻
def cryo():
    out = {}
    W, H, CX, GY = 34, 30, 17, 28
    ice, ice_l, ice_d = C(132, 204, 242), C(214, 244, 255), C(78, 142, 204)
    for i, (rx, ry) in enumerate(((10, 8), (12.5, 6), (8, 11))):
        a = new(W, H)
        cy = GY - ry + 1
        ellipse(a, CX, cy + 1, rx, ry, ice_d)
        ellipse(a, CX - 0.5, cy, rx - 1, ry - 1, ice)
        rect(a, 0, GY, W, 4, (0, 0, 0, 0))
        ellipse(a, CX - rx * 0.35, cy - ry * 0.4, rx * 0.35, ry * 0.25, ice_l)
        for dx in (-5, 0, 5):
            poly(a, [(CX + dx - 2, cy - ry + 3), (CX + dx, cy - ry - 3 - (1 if dx == 0 else 0)), (CX + dx + 2, cy - ry + 3)], ice_l)
            put(a, CX + dx, cy - ry - 3, WHITE)
        eyes(a, CX, cy - 1, gap=5, white=K, pupil=WHITE)
        hline(a, CX + 2, CX + 4, cy + 3, K)
        put(a, CX - 5, cy + 3, ice_l)
        put(a, CX - 3, cy + 1, ice_l)
        out[f'm/cryo/{i}'] = finish(a, CX, GY)
    return out


# ---------------------------------------------------------------- 焦耳
def joule():
    out = {}
    W, H, CX, GY = 30, 38, 15, 34
    o, y, w = C(255, 130, 50), C(255, 208, 104), C(255, 250, 220)
    for i in range(3):
        a = new(W, H)
        wob = (i - 1) * 2
        tips = [(-6 + wob, -24), (0 - wob, -30), (6 + wob, -22)]
        poly(a, [(CX - 9, GY - 6), (CX - 7, GY - 14), (CX + tips[0][0], GY + tips[0][1]), (CX - 2, GY - 18), (CX + tips[1][0], GY + tips[1][1]),
                 (CX + 3, GY - 18), (CX + tips[2][0], GY + tips[2][1]), (CX + 8, GY - 13), (CX + 9, GY - 6), (CX + 5, GY), (CX - 5, GY)], o)
        poly(a, [(CX - 6, GY - 5), (CX - 4, GY - 13), (CX - wob, GY - 22), (CX + 4, GY - 13), (CX + 6, GY - 5), (CX + 3, GY - 1), (CX - 3, GY - 1)], y)
        ellipse(a, CX, GY - 6, 3.2, 4, w)
        rect(a, CX - 3, GY - 11, 2, 3, K)
        rect(a, CX + 2, GY - 11, 2, 3, K)
        put(a, CX - 4, GY - 12, K)
        put(a, CX + 4, GY - 12, K)
        hline(a, CX - 1, CX + 1, GY - 5, C(200, 80, 30))
        out[f'm/joule/{i}'] = finish(a, CX, GY)
    return out


# ---------------------------------------------------------------- 瓦特
def watt():
    out = {}
    W, H, CX, GY = 42, 48, 20, 46
    cop, iron = C(196, 116, 72), C(74, 70, 80)

    def draw(a, lp, vent, hot):
        la, lb = ((-1, 1), (0, 0), (1, -1), (0, 0))[lp]
        base = mix(cop, C(255, 90, 50), 0.45) if hot else cop
        for off in (la - 6, lb + 3):
            block(a, CX + off, GY - 6, 5, 6, iron)
        bob = -1 if lp % 2 else 0
        y = GY - 32 + bob + (1 if vent else 0)
        # 烟囱
        block(a, CX - 7, y - 8, 5, 9, iron)
        rect(a, CX - 8, y - 9, 7, 2, shade(iron, 1.5))
        for k, (dx, dy) in enumerate(((0, -12), (-2, -15), (1, -18))):
            if (k + lp) % 2 == 0 or vent:
                ball(a, CX - 5 + dx, y + dy, 2, 2, C(226, 226, 236), spec=False)
        # 锅炉
        ellipse(a, CX, y + 4, 10, 5, base)
        rect(a, CX - 10, y + 4, 20, 20, base)
        ellipse(a, CX, y + 24, 10, 4, shade(base, 0.72))
        rect(a, CX + 6, y + 4, 4, 20, shade(base, 0.72))
        rect(a, CX - 9, y + 4, 2, 19, shade(base, 1.28))
        for ry in (y + 8, y + 19):
            hline(a, CX - 10, CX + 9, ry, shade(base, 0.6))
            for rx in range(CX - 8, CX + 9, 4):
                put(a, rx, ry - 1, shade(base, 1.35))
        # 压力表（眼睛）
        ball(a, CX + 3, y + 13, 4.5, 4.5, WHITE, spec=False)
        ring(a, CX + 3, y + 13, 4.5, 4.5, K)
        if hot:
            line(a, CX + 3, y + 13, CX + 6, y + 11, C(255, 40, 40))
        else:
            line(a, CX + 3, y + 13, CX + 5, y + 15, C(220, 60, 60))
        # 炉门
        rect(a, CX - 7, y + 21, 7, 4, K)
        hline(a, CX - 6, CX - 2, y + 22, C(255, 170, 60))
        hline(a, CX - 6, CX - 2, y + 23, C(255, 110, 40))
        # 喷嘴臂
        tube(a, CX + 9, y + 15, CX + 15, y + 15, 2, iron)
        rect(a, CX + 15, y + 12, 3, 7, shade(iron, 1.4))
        if vent:
            for k in range(4):
                ball(a, CX + 20 + k * 1, y + 15 + (k % 2) * 2 - 1, 1.5, 1.5, C(236, 236, 244), spec=False)

    for i in range(4):
        a = new(W, H)
        draw(a, i, False, False)
        out[f'm/watt/walk/{i}'] = finish(a, CX, GY)
    for i in range(2):
        a = new(W, H)
        draw(a, i, True, False)
        out[f'm/watt/vent/{i}'] = finish(a, CX, GY)
    for i in range(2):
        a = new(W, H)
        draw(a, i * 2, i == 1, True)
        out[f'm/watt/hot/{i}'] = finish(a, CX, GY)
    return out


# ---------------------------------------------------------------- 小妖
def imp():
    out = {}
    W, H, CX, CY = 36, 34, 17, 17
    skin, hot, cold = C(150, 118, 176), C(224, 84, 60), C(84, 156, 232)

    def draw(a, wing_up, throw):
        for s in (-1, 1):
            wy = CY - (8 if wing_up else 0)
            poly(a, [(CX + s * 4, CY + 1), (CX + s * 13, wy), (CX + s * 12, wy + 6), (CX + s * 8, CY + 5)], C(92, 64, 118))
            line(a, CX + s * 4, CY + 1, CX + s * 13, wy, C(150, 110, 180))
        # 尾巴
        line(a, CX - 3, CY + 9, CX - 9, CY + 12, skin)
        poly(a, [(CX - 9, CY + 10), (CX - 13, CY + 12), (CX - 9, CY + 14)], hot)
        # 身体：左热右冷
        ellipse(a, CX, CY + 6, 5, 5.5, hot)
        rect(a, CX, CY, 6, 12, (0, 0, 0, 0))
        b = new(W, H)
        ellipse(b, CX, CY + 6, 5, 5.5, cold)
        m = b[..., 3] > 0
        m[:, :CX] = False
        a[m] = b[m]
        # 头
        ball(a, CX + 1, CY - 4, 6, 5.5, skin)
        poly(a, [(CX - 4, CY - 8), (CX - 5, CY - 13), (CX - 1, CY - 9)], C(240, 230, 210))
        poly(a, [(CX + 3, CY - 9), (CX + 6, CY - 13), (CX + 6, CY - 8)], C(240, 230, 210))
        rect(a, CX, CY - 5, 2, 2, C(255, 224, 90))
        rect(a, CX + 4, CY - 5, 2, 2, C(255, 224, 90))
        put(a, CX + 1, CY - 4, K)
        put(a, CX + 5, CY - 4, K)
        hline(a, CX + 1, CX + 5, CY - 1, K)
        put(a, CX + 2, CY, WHITE)
        put(a, CX + 4, CY, WHITE)
        # 手
        if throw:
            tube(a, CX + 4, CY + 4, CX + 11, CY + 1, 1.4, skin)
        else:
            tube(a, CX + 4, CY + 5, CX + 8, CY + 8, 1.4, skin)

    for i in range(2):
        a = new(W, H)
        draw(a, i == 0, False)
        out[f'm/imp/fly/{i}'] = finish(a, CX, CY + 12)
    a = new(W, H)
    draw(a, True, True)
    out['m/imp/throw'] = finish(a, CX, CY + 12)
    return out


# ---------------------------------------------------------------- 猫（叠加猫 / 友方猫）
def cat(prefix, fur, belly, eye):
    out = {}
    W, H, CX, GY = 44, 30, 20, 28
    dk = shade(fur, 0.7)

    def draw(a, lp, pose):
        if pose == 'walk':
            offs = ((-1, 1, 1, -1), (0, 0, 0, 0), (1, -1, -1, 1), (0, 0, 0, 0))[lp]
            for k, x in enumerate((CX - 8, CX - 5, CX + 3, CX + 6)):
                rect(a, x + offs[k], GY - 6, 2, 6, dk if k % 2 == 0 else fur)
            ellipse(a, CX - 1, GY - 10, 10, 5.2, fur)
            ellipse(a, CX - 1, GY - 8, 8, 3, belly)
            ellipse(a, CX - 1, GY - 11, 10, 4.4, fur)
            hx, hy = CX + 10, GY - 15
            tail = [(CX - 10, GY - 11), (CX - 15, GY - 15 - (lp % 2)), (CX - 16, GY - 21)]
        elif pose == 'pounce':
            rect(a, CX - 12, GY - 9, 5, 2, dk)
            rect(a, CX + 8, GY - 8, 6, 2, fur)
            ellipse(a, CX - 1, GY - 11, 12, 4.4, fur)
            ellipse(a, CX - 1, GY - 9.5, 9, 2.4, belly)
            hx, hy = CX + 12, GY - 13
            tail = [(CX - 12, GY - 12), (CX - 18, GY - 13), (CX - 20, GY - 16)]
        else:  # sit
            ellipse(a, CX - 2, GY - 7, 7, 7, fur)
            ellipse(a, CX, GY - 5, 4, 4.5, belly)
            rect(a, CX + 2, GY - 5, 2, 5, fur)
            hx, hy = CX + 3, GY - 17
            tail = [(CX - 8, GY - 3), (CX - 13, GY - 5), (CX - 14, GY - 10)]
        for (x0, y0), (x1, y1) in zip(tail, tail[1:]):
            line(a, x0, y0, x1, y1, fur, 2)
        ball(a, hx, hy, 5.5, 5, fur)
        poly(a, [(hx - 5, hy - 3), (hx - 4, hy - 9), (hx - 1, hy - 4)], fur)
        poly(a, [(hx + 1, hy - 4), (hx + 4, hy - 9), (hx + 5, hy - 3)], fur)
        put(a, hx - 3, hy - 6, belly)
        put(a, hx + 3, hy - 6, belly)
        rect(a, hx - 1, hy - 2, 2, 2, eye)
        rect(a, hx + 3, hy - 2, 2, 2, eye)
        put(a, hx + 2, hy + 1, C(255, 150, 160))
        hline(a, hx + 5, hx + 7, hy + 1, belly)

    for i in range(4):
        a = new(W, H)
        draw(a, i, 'walk')
        out[f'{prefix}/walk/{i}'] = finish(a, CX, GY)
    a = new(W, H)
    draw(a, 0, 'pounce')
    out[f'{prefix}/pounce'] = finish(a, CX, GY)
    a = new(W, H)
    draw(a, 0, 'sit')
    out[f'{prefix}/sit'] = finish(a, CX, GY)
    return out


# ---------------------------------------------------------------- 夸克团
def quark():
    out = {}
    W, H, CX, CY = 40, 40, 20, 20
    cols = (C(232, 72, 72), C(92, 214, 112), C(84, 144, 244))
    for i in range(3):
        a = new(W, H)
        pts = []
        for k in range(3):
            ang = k / 3 * math.tau + i * 0.7 - 1.57
            pts.append((CX + math.cos(ang) * 10, CY + math.sin(ang) * 10))
        # 胶子弹簧线
        for k in range(3):
            (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % 3]
            n = 7
            for j in range(n):
                t0, t1 = j / n, (j + 1) / n
                nx, ny = -(y1 - y0), (x1 - x0)
                d = math.hypot(nx, ny) or 1
                o0 = (1 if j % 2 else -1) * 1.6
                o1 = -o0
                line(a, x0 + (x1 - x0) * t0 + nx / d * o0, y0 + (y1 - y0) * t0 + ny / d * o0,
                     x0 + (x1 - x0) * t1 + nx / d * o1, y0 + (y1 - y0) * t1 + ny / d * o1, C(240, 240, 250))
        for k in sorted(range(3), key=lambda q: pts[q][1]):
            x, y = pts[k]
            ball(a, x, y, 5.2, 5.2, cols[k])
            put(a, int(x) - 1, int(y), K)
            put(a, int(x) + 2, int(y), K)
        out[f'm/quark/{i}'] = finish(a, CX, CY + 14)
    for k, name in enumerate('rgb'):
        for i in range(2):
            a = new(14, 14)
            ball(a, 7, 7 - i, 4.5, 4.5 - i * 0.5, cols[k])
            rect(a, 6, 6 - i, 2, 2, WHITE)
            rect(a, 9, 6 - i, 2, 2, WHITE)
            put(a, 7, 7 - i, K)
            put(a, 10, 7 - i, K)
            put(a, 5, 4 - i, K)
            put(a, 11, 4 - i, K)
            out[f'm/quarkmini/{name}/{i}'] = finish(a, 7, 12)
    return out


# ---------------------------------------------------------------- 幽灵粒子
def neutrino():
    out = {}
    W, H, CX, CY = 20, 28, 10, 9
    c0, c1 = C(214, 248, 255), C(140, 214, 240)
    for i in range(2):
        a = new(W, H)
        ball(a, CX, CY, 5, 5, c0, lo=c1)
        for k in range(10):
            wx = CX + round(math.sin((k + i * 2) * 0.9) * 2)
            wdt = max(1, 5 - k // 2)
            for dx in range(-wdt // 2, wdt // 2 + 1):
                if (k + dx) % 2 == 0 or k < 3:
                    put(a, wx + dx, CY + 4 + k, c1 if k > 4 else c0)
        rect(a, CX - 3, CY - 1, 2, 3, K)
        rect(a, CX + 1, CY - 1, 2, 3, K)
        out[f'm/neutrino/{i}'] = finish(a, CX, CY + 12, outline=False)
    return out


# ---------------------------------------------------------------- 奇点幼体
def singlet():
    out = {}
    W, H, CX, CY = 36, 36, 18, 18
    for i in range(3):
        a = new(W, H)
        # 后半圈吸积环
        for k in range(40):
            ang = k / 40 * math.tau
            x, y = CX + math.cos(ang) * 13, CY + math.sin(ang) * 4.5
            if math.sin(ang) < 0:
                put(a, int(x), int(y), C(150, 90, 210))
        ball(a, CX, CY, 7.5, 7.5, C(26, 18, 40), hi=C(60, 40, 90), lo=C(12, 8, 20))
        ring(a, CX, CY, 8.5, 8.5, C(190, 120, 255))
        for k in range(40):
            ang = k / 40 * math.tau
            x, y = CX + math.cos(ang) * 13, CY + math.sin(ang) * 4.5
            if math.sin(ang) >= 0:
                bright = (k + i * 5) % 14 < 4
                put(a, int(x), int(y), WHITE if bright else C(206, 150, 255))
                put(a, int(x), int(y) + 1, C(150, 90, 210))
        rect(a, CX - 1, CY - 2, 4, 4, C(255, 240, 255))
        rect(a, CX, CY - 1, 2, 2, C(170, 40, 220))
        out[f'm/singlet/{i}'] = finish(a, CX, CY + 9, outline=False)
    return out


# ---------------------------------------------------------------- 首领「奇点」核心
def core():
    out = {}
    W, H, CX, CY = 72, 72, 36, 36
    for i in range(4):
        a = new(W, H)
        ball(a, CX, CY, 20, 20, C(22, 14, 36), hi=C(58, 36, 92), lo=C(10, 6, 18))
        # 旋臂
        for arm in range(3):
            for k in range(26):
                t = k / 26
                ang = arm * math.tau / 3 + i * 0.5 + t * 3.4
                r = 3 + t * 15
                x, y = CX + math.cos(ang) * r, CY + math.sin(ang) * r
                col = mix(C(255, 255, 255), C(150, 70, 230), t)
                put(a, int(x), int(y), col)
                if k % 3 == 0:
                    put(a, int(x) + 1, int(y), mix(col, C(40, 20, 70), 0.5))
        ring(a, CX, CY, 21.5, 21.5, C(206, 140, 255), 1.4)
        ring(a, CX, CY, 23, 23, C(120, 70, 190), 1.0)
        out[f'boss/core/{i}'] = Sprite(a, CX, CY)
    # 眼：0 闭 1 半开 2 全开
    for i, hgt in enumerate((1, 4, 8)):
        a = new(28, 20)
        ellipse(a, 14, 10, 11, hgt, WHITE)
        if hgt > 1:
            ellipse(a, 14, 10, min(5, hgt), min(5, hgt), C(255, 70, 110))
            ellipse(a, 14, 10, min(2.4, hgt), min(2.4, hgt), K)
            put(a, 12, 8, WHITE)
        out[f'boss/eye/{i}'] = finish(a, 14, 10)
    return out


def register(atlas):
    allsp = {}
    for fn in (grad, hopper, weight, cart, bat, orb, tesla, crab, scope, sentinel, cryo, joule, watt, imp, quark, neutrino, singlet, core):
        allsp.update(fn())
    allsp.update(cat('m/cat', C(64, 54, 100), C(110, 96, 150), C(120, 255, 230)))
    allsp.update(cat('obj/cat', C(232, 152, 72), C(250, 220, 170), C(120, 220, 90)))
    for name, spr in allsp.items():
        atlas.add(name, spr)
    return allsp


if __name__ == '__main__':
    import sys
    from px import Atlas, preview
    at = Atlas()
    sp = register(at)
    groups = {}
    for k, v in sp.items():
        groups.setdefault(k.split('/')[1] if not k.startswith('boss') else 'boss', []).append(v)
    flat = []
    cols = 8
    for g, lst in groups.items():
        flat += lst[:cols] + [Sprite(new(1, 1))] * (cols - len(lst[:cols]))
    print(preview(flat, sys.argv[1], zoom=4, cols=cols))
