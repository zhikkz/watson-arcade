"""像素美术工具箱：精灵容器、图集打包、基础绘制/描边/调色工具。

所有美术资源都在构建期由 Python 生成为一张图集 (atlas.png + atlas.json)，
游戏运行时只做整像素 blit。
"""
import json
import math
import numpy as np
from PIL import Image

OUTLINE = (20, 16, 26)


class Sprite:
    """RGBA uint8 数组 + 锚点（锚点 = 实体坐标在精灵中的位置）。"""

    def __init__(self, arr, ax=0, ay=0):
        self.arr = np.ascontiguousarray(arr, dtype=np.uint8)
        self.ax = int(ax)
        self.ay = int(ay)

    @property
    def w(self):
        return self.arr.shape[1]

    @property
    def h(self):
        return self.arr.shape[0]

    def trimmed(self):
        a = self.arr[..., 3]
        ys, xs = np.nonzero(a)
        if len(xs) == 0:
            return Sprite(np.zeros((1, 1, 4), np.uint8), 0, 0)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        return Sprite(self.arr[y0:y1, x0:x1], self.ax - x0, self.ay - y0)

    def image(self):
        return Image.fromarray(self.arr, 'RGBA')


def new(w, h):
    return np.zeros((h, w, 4), np.uint8)


def hexc(s, a=255):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)


def mix(c1, c2, t):
    return tuple(int(round(c1[i] * (1 - t) + c2[i] * t)) for i in range(3)) + (255,)


def shade(c, f):
    """f<1 变暗并略偏冷，f>1 变亮并略偏暖。"""
    r, g, b = c[:3]
    if f <= 1:
        r2, g2, b2 = r * f, g * f, b * (f + (1 - f) * 0.18)
    else:
        k = f - 1
        r2, g2, b2 = r + (255 - r) * k, g + (255 - g) * k * 0.92, b + (255 - b) * k * 0.8
    return (int(max(0, min(255, r2))), int(max(0, min(255, g2))), int(max(0, min(255, b2))), 255)


def ramp(c, n=4, lo=0.55, hi=1.35):
    """由基色生成 n 级明暗色阶（暗 -> 亮）。"""
    return [shade(c, lo + (hi - lo) * i / (n - 1)) for i in range(n)]


# ---------------------------------------------------------------- 绘制原语

def put(a, x, y, c):
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]:
        a[y, x] = c


def rect(a, x, y, w, h, c):
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(a.shape[1], x + w), min(a.shape[0], y + h)
    if x1 > x0 and y1 > y0:
        a[y0:y1, x0:x1] = c


def frame(a, x, y, w, h, c):
    rect(a, x, y, w, 1, c)
    rect(a, x, y + h - 1, w, 1, c)
    rect(a, x, y, 1, h, c)
    rect(a, x + w - 1, y, 1, h, c)


def hline(a, x0, x1, y, c):
    rect(a, min(x0, x1), y, abs(x1 - x0) + 1, 1, c)


def vline(a, x, y0, y1, c):
    rect(a, x, min(y0, y1), 1, abs(y1 - y0) + 1, c)


def line(a, x0, y0, x1, y1, c, thick=1):
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        if thick <= 1:
            put(a, x0, y0, c)
        else:
            o = thick // 2
            rect(a, x0 - o, y0 - o, thick, thick, c)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def ellipse(a, cx, cy, rx, ry, c):
    """实心椭圆（中心可为 .5 坐标），无抗锯齿。"""
    h, w = a.shape[:2]
    y0, y1 = int(math.floor(cy - ry)), int(math.ceil(cy + ry))
    x0, x1 = int(math.floor(cx - rx)), int(math.ceil(cx + rx))
    for y in range(max(0, y0), min(h, y1 + 1)):
        for x in range(max(0, x0), min(w, x1 + 1)):
            dx = (x + 0.5 - cx) / max(rx, 0.01)
            dy = (y + 0.5 - cy) / max(ry, 0.01)
            if dx * dx + dy * dy <= 1.0:
                a[y, x] = c


def ring(a, cx, cy, rx, ry, c, t=1.0):
    h, w = a.shape[:2]
    for y in range(max(0, int(cy - ry - 1)), min(h, int(cy + ry + 2))):
        for x in range(max(0, int(cx - rx - 1)), min(w, int(cx + rx + 2))):
            dx = (x + 0.5 - cx)
            dy = (y + 0.5 - cy)
            o = (dx / max(rx, 0.01)) ** 2 + (dy / max(ry, 0.01)) ** 2
            i = (dx / max(rx - t, 0.01)) ** 2 + (dy / max(ry - t, 0.01)) ** 2
            if o <= 1.0 and i > 1.0:
                a[y, x] = c


def poly(a, pts, c):
    """实心多边形（扫描线）。"""
    h, w = a.shape[:2]
    ys = [p[1] for p in pts]
    for y in range(max(0, int(math.floor(min(ys)))), min(h, int(math.ceil(max(ys))) + 1)):
        yc = y + 0.5
        xs = []
        n = len(pts)
        for i in range(n):
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % n]
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            xa = int(math.ceil(xs[i] - 0.5))
            xb = int(math.floor(xs[i + 1] - 0.5))
            if xb >= xa:
                rect(a, xa, y, xb - xa + 1, 1, c)


def blit(dst, src, x, y, flip=False):
    """alpha(二值) 贴图。src 可为数组或 Sprite（Sprite 用锚点对齐）。"""
    if isinstance(src, Sprite):
        x -= src.ax
        y -= src.ay
        src = src.arr
    if flip:
        src = src[:, ::-1]
    h, w = src.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    m = s[..., 3] > 0
    dst[y0:y1, x0:x1][m] = s[m]


def text_art(a, x, y, rows, pal):
    """用字符画绘制：rows 为字符串列表，pal 为 {char: color}，'.'/' ' 透明。"""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in pal:
                put(a, x + i, y + j, pal[ch])


def from_art(rows, pal):
    w = max(len(r) for r in rows)
    a = new(w, len(rows))
    text_art(a, 0, 0, rows, pal)
    return a


# ---------------------------------------------------------------- 后处理

def mask(a):
    return a[..., 3] > 0


def _neighbors4(m):
    p = np.pad(m, 1)
    return p[1:-1, :-2], p[1:-1, 2:], p[:-2, 1:-1], p[2:, 1:-1]


def outline_outer(a, c=OUTLINE, diag=False):
    """在轮廓外侧加 1px 描边（需要画布留白）。"""
    m = mask(a)
    l, r, u, d = _neighbors4(m)
    g = l | r | u | d
    if diag:
        p = np.pad(m, 1)
        g = g | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
    edge = g & ~m
    out = a.copy()
    out[edge] = (c[0], c[1], c[2], 255)
    return out


def outline_inner(a, c=OUTLINE, strength=1.0):
    """把轮廓最外圈像素压暗成描边。"""
    m = mask(a)
    l, r, u, d = _neighbors4(m)
    edge = m & ~(l & r & u & d)
    out = a.copy()
    e = out[edge][:, :3].astype(np.float64)
    cc = np.array(c[:3], np.float64)
    out[edge, :3] = np.clip(e * (1 - strength) + cc * strength + 0.5, 0, 255).astype(np.uint8)
    return out


def shade_rim(a, light=(-1, -1), hi=1.22, lo=0.72, only=None):
    """简易体积感：朝光一侧的内缘提亮，背光一侧压暗。only 可限定作用的掩码。"""
    m = mask(a)
    p = np.pad(m, 1)
    lx, ly = light
    toward = p[1 + ly:p.shape[0] - 1 + ly, 1 + lx:p.shape[1] - 1 + lx]
    away = p[1 - ly:p.shape[0] - 1 - ly, 1 - lx:p.shape[1] - 1 - lx]
    lit = m & ~toward
    dark = m & ~away
    if only is not None:
        lit &= only
        dark &= only
    out = a.copy()
    f = out[..., :3].astype(np.float64)
    f[lit] = np.clip(f[lit] * hi + 6, 0, 255)
    f[dark] = f[dark] * lo
    out[..., :3] = f.astype(np.uint8)
    return out


def tint(a, c, t):
    out = a.copy()
    m = mask(a)
    f = out[..., :3].astype(np.float64)
    f[m] = f[m] * (1 - t) + np.array(c[:3], np.float64) * t
    out[..., :3] = np.clip(f, 0, 255).astype(np.uint8)
    return out


def recolor(a, mapping):
    """精确颜色替换 {(r,g,b): (r,g,b)}。"""
    out = a.copy()
    for src, dst in mapping.items():
        sel = (a[..., 0] == src[0]) & (a[..., 1] == src[1]) & (a[..., 2] == src[2]) & (a[..., 3] > 0)
        out[sel, 0], out[sel, 1], out[sel, 2] = dst[0], dst[1], dst[2]
    return out


def scale2x(a, f=2):
    return np.repeat(np.repeat(a, f, axis=0), f, axis=1)


def rotate90(a, k=1):
    return np.ascontiguousarray(np.rot90(a, k))


def flip_h(a):
    return np.ascontiguousarray(a[:, ::-1])


def flip_v(a):
    return np.ascontiguousarray(a[::-1])


def noise_shade(a, rng, amt=6, only=None):
    """给填充区加入轻微的逐像素明度抖动，避免大面积死平。"""
    m = mask(a) if only is None else (mask(a) & only)
    n = rng.integers(-amt, amt + 1, size=a.shape[:2])
    out = a.copy()
    f = out[..., :3].astype(np.int32)
    f[m] = np.clip(f[m] + n[m][:, None], 0, 255)
    out[..., :3] = f.astype(np.uint8)
    return out


# ---------------------------------------------------------------- 图集

class Atlas:
    def __init__(self, width=1024, pad=1):
        self.width = width
        self.pad = pad
        self.items = []  # (name, Sprite)
        self.meta = {}

    def add(self, name, spr, trim=True):
        if not isinstance(spr, Sprite):
            spr = Sprite(spr)
        if trim:
            spr = spr.trimmed()
        self.items.append((name, spr))

    def add_strip(self, name, arr, n, ax=0, ay=0, trim=True):
        """把横向等宽条带拆成 n 帧：name/0..n-1"""
        w = arr.shape[1] // n
        for i in range(n):
            self.add(f'{name}/{i}', Sprite(arr[:, i * w:(i + 1) * w], ax, ay), trim=trim)

    def pack(self):
        order = sorted(range(len(self.items)), key=lambda i: (-self.items[i][1].h, -self.items[i][1].w))
        x = y = 0
        rowh = 0
        pos = {}
        W = self.width
        for i in order:
            name, s = self.items[i]
            if s.w + self.pad > W:
                raise ValueError(f'sprite too wide: {name} {s.w}')
            if x + s.w + self.pad > W:
                x = 0
                y += rowh + self.pad
                rowh = 0
            pos[i] = (x, y)
            x += s.w + self.pad
            rowh = max(rowh, s.h)
        H = y + rowh + self.pad
        # 高度向上取整到 16
        H = (H + 15) // 16 * 16
        sheet = np.zeros((H, W, 4), np.uint8)
        frames = {}
        for i, (name, s) in enumerate(self.items):
            px, py = pos[i]
            sheet[py:py + s.h, px:px + s.w] = s.arr
            if name in frames:
                raise ValueError('duplicate sprite name ' + name)
            frames[name] = [px, py, s.w, s.h, s.ax, s.ay]
        return sheet, frames

    def save(self, png_path, json_path, extra=None):
        sheet, frames = self.pack()
        Image.fromarray(sheet, 'RGBA').save(png_path, optimize=True)
        data = {'w': sheet.shape[1], 'h': sheet.shape[0], 'frames': frames}
        if extra:
            data.update(extra)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        return sheet, frames


def preview(sprites, path, zoom=4, cols=8, bg=(58, 62, 78, 255), cell=None, labels=None):
    """把若干精灵排成预览图（带锚点十字），用于人工检查。"""
    sprites = [s if isinstance(s, Sprite) else Sprite(s) for s in sprites]
    cw = cell[0] if cell else max(s.w for s in sprites) + 2
    ch = cell[1] if cell else max(s.h for s in sprites) + 2
    rows = (len(sprites) + cols - 1) // cols
    sheet = np.zeros((rows * ch, cols * cw, 4), np.uint8)
    sheet[...] = bg
    for i, s in enumerate(sprites):
        cx, cy = (i % cols) * cw, (i // cols) * ch
        ox = cx + (cw - s.w) // 2
        oy = cy + (ch - s.h) // 2
        m = s.arr[..., 3] > 0
        sheet[oy:oy + s.h, ox:ox + s.w][m] = s.arr[m]
    im = Image.fromarray(sheet, 'RGBA').resize((sheet.shape[1] * zoom, sheet.shape[0] * zoom), Image.NEAREST)
    im.save(path)
    return im.size


# ---------------------------------------------------------------- 带明暗的图元

def ball(a, cx, cy, rx, ry, base, hi=None, lo=None, spec=True):
    """三色调球体：左上受光。"""
    lo = lo or shade(base, 0.7)
    hi = hi or shade(base, 1.28)
    ellipse(a, cx, cy, rx, ry, lo)
    ellipse(a, cx - 0.7, cy - 0.7, max(0.6, rx - 0.9), max(0.6, ry - 0.9), base)
    if spec and rx >= 3 and ry >= 3:
        ellipse(a, cx - rx * 0.36, cy - ry * 0.42, max(0.9, rx * 0.3), max(0.8, ry * 0.24), hi)


def block(a, x, y, w, h, base, hi=None, lo=None):
    """带斜面的矩形：上/左亮，下/右暗。"""
    lo = lo or shade(base, 0.7)
    hi = hi or shade(base, 1.25)
    rect(a, x, y, w, h, base)
    if w >= 3 and h >= 3:
        rect(a, x, y, w, 1, hi)
        rect(a, x, y, 1, h, hi)
        rect(a, x, y + h - 1, w, 1, lo)
        rect(a, x + w - 1, y, 1, h, lo)


def tube(a, x0, y0, x1, y1, r, base):
    """粗线段（肢体 / 管道）：中心线偏亮。"""
    lo = shade(base, 0.72)
    hi = shade(base, 1.2)
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / max(1, n)
        ellipse(a, x0 + (x1 - x0) * t + 0.5, y0 + (y1 - y0) * t + 0.5, r, r, lo)
    for i in range(n + 1):
        t = i / max(1, n)
        ellipse(a, x0 + (x1 - x0) * t + 0.2, y0 + (y1 - y0) * t + 0.2, max(0.5, r - 0.7), max(0.5, r - 0.7), base)
    if r >= 2:
        line(a, x0, y0 - r * 0.4, x1, y1 - r * 0.4, hi)


def finish(a, ax, ay, outline=True, diag=False):
    """加外描边并包装成 Sprite（锚点为 ax, ay）。"""
    if outline:
        a = outline_outer(a, OUTLINE, diag=diag)
    return Sprite(a, ax, ay)


def eyes(a, x, y, gap=4, white=(255, 255, 255, 255), pupil=(20, 16, 26, 255), look=1, angry=False):
    """一对 2x2 的小眼睛。"""
    for ex in (x, x + gap):
        rect(a, ex, y, 2, 2, white)
        put(a, ex + (1 if look > 0 else 0), y + 1, pupil)
        if angry:
            put(a, ex + (0 if ex == x else 1), y - 1, pupil)
