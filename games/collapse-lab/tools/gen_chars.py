"""把用户提供的高清帧（张震 / 嘟礼，384x320）转换为游戏内像素精灵。

- 逐帧按规则对齐锚点（去掉原动画里烘焙进去的位移，位移交给游戏物理）
- 盒式滤波缩小 + alpha 二值化 + 轻度锐化 + 压暗外圈描边
- 输出 {name: Sprite}，锚点 = 角色脚底中心
"""
import os
import numpy as np
from PIL import Image
from px import Sprite, outline_inner

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets-src')
GROUND = 294  # 源图地面线（脚底下边缘）


def load(path):
    return np.array(Image.open(path).convert('RGBA'))


def measure(a):
    m = a[..., 3] > 0
    ys, xs = np.nonzero(m)
    top, bot = ys.min(), ys.max()
    fm = m[bot - 7:bot + 1]
    fx = np.nonzero(fm.any(axis=0))[0]
    hm = m[top:top + 40]
    hx = np.nonzero(hm.any(axis=0))[0]
    return {
        'cx': xs.mean(), 'cy': ys.mean(), 'top': top, 'bot': bot,
        'fc': (fx.min() + fx.max()) / 2.0, 'hc': (hx.min() + hx.max()) / 2.0,
        'x0': xs.min(), 'x1': xs.max(),
    }


def downscale(a, f, thr=0.5):
    h, w = a.shape[:2]
    H, W = h // f, w // f
    a = a[:H * f, :W * f].astype(np.float64)
    al = a[..., 3:4] / 255.0
    pm = (a[..., :3] * al).reshape(H, f, W, f, 3).sum(axis=(1, 3))
    asum = al.reshape(H, f, W, f, 1).sum(axis=(1, 3))
    rgb = np.where(asum > 0, pm / np.maximum(asum, 1e-9), 0)
    alpha = (asum / (f * f)) >= thr
    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = np.clip(rgb + 0.5, 0, 255).astype(np.uint8)
    out[..., 3] = alpha[..., 0] * 255
    out[~alpha[..., 0]] = 0
    return out


def sharpen(img, amt=0.5):
    m = img[..., 3] > 0
    rgb = img[..., :3].astype(np.float64)
    k = np.array([[1, 2, 1], [2, 4, 2], [1, 2, 1]], np.float64)
    k /= k.sum()

    def conv(x):
        p = np.pad(x, ((1, 1), (1, 1), (0, 0)), mode='edge')
        o = np.zeros_like(x)
        for dy in range(3):
            for dx in range(3):
                o += k[dy, dx] * p[dy:dy + x.shape[0], dx:dx + x.shape[1]]
        return o

    mm = m.astype(np.float64)[..., None]
    num, den = conv(rgb * mm), conv(mm)
    blur = np.where(den > 0, num / np.maximum(den, 1e-9), rgb)
    out = img.copy()
    out[..., :3] = np.clip(rgb + amt * (rgb - blur) + 0.5, 0, 255).astype(np.uint8)
    out[~m] = 0
    return out


def convert(a, sx, sy, f, sharp=0.5, edge=0.8):
    """把源图中的点 (sx, sy) 对齐到锚点后缩小 f 倍。"""
    CW, CH = 768, 800
    AX, AY = 320, 480  # f 的整数倍
    canvas = np.zeros((CH, CW, 4), np.uint8)
    ox, oy = AX - int(round(sx)), AY - int(round(sy))
    h, w = a.shape[:2]
    canvas[oy:oy + h, ox:ox + w] = a
    small = downscale(canvas, f)
    if sharp:
        small = sharpen(small, sharp)
    if edge:
        small = outline_inner(small, strength=edge)
    return Sprite(small, AX // f, AY // f).trimmed()


# ---------------------------------------------------------------- 张震

HERO_STAND_CY = 182.5   # 站立帧的质心高度，用于空中帧的纵向对齐
HERO_AX = 160.5


def hero_anchor(act, idx, m):
    if act == '01_idle':
        return m['fc'] - 0.5, GROUND              # 以脚为准，消除待机帧的整体漂移
    if act == '02_run':
        return m['hc'] + 0.5, GROUND              # 以头为准，跑动时头部稳定
    if act == '03_jump':
        if idx in (0, 7):
            return m['fc'] - 0.5, GROUND
        if idx in (1, 6):
            return HERO_AX, GROUND
        return m['hc'] + 0.5, m['cy'] + (GROUND - HERO_STAND_CY)
    if act == '04_air_tuck':
        return m['hc'] + 0.5, m['cy'] + (GROUND - HERO_STAND_CY)
    if act == '05_slide':
        if idx in (0, 10):
            return m['fc'] - 0.5, GROUND
        return HERO_AX, GROUND
    raise KeyError(act)


HERO_ACTS = [('01_idle', 'idle'), ('02_run', 'run'), ('03_jump', 'jump'), ('04_air_tuck', 'tuck'), ('05_slide', 'slide')]


def gen_hero(f=4, prefix='hero', acts=None, sharp=0.5, edge=0.8):
    out = {}
    base = os.path.join(ROOT, 'zhangzhen', 'frames')
    for src, name in HERO_ACTS:
        if acts and name not in acts:
            continue
        d = os.path.join(base, src)
        for i, fn in enumerate(sorted(os.listdir(d))):
            a = load(os.path.join(d, fn))
            sx, sy = hero_anchor(src, i, measure(a))
            out[f'{prefix}/{name}/{i}'] = convert(a, sx, sy, f, sharp, edge)
    return out


# ---------------------------------------------------------------- 嘟礼

DULI_AX = 138.0
DULI_STAND_CY = 201.7
DULI_FEET_TO_BODY = 4.5


def duli_anchor(act, idx, m):
    if act == '01_monster_idle':
        return m['fc'] + DULI_FEET_TO_BODY, GROUND
    if act == '03_monster_pounce':
        if idx in (0, 7):
            return m['fc'] + DULI_FEET_TO_BODY, GROUND
        if idx == 1:
            return DULI_AX, GROUND
        if idx == 6:
            return m['cx'] - 6.8, GROUND
        return m['cx'], m['cy'] + (GROUND - DULI_STAND_CY)
    return DULI_AX, GROUND


DULI_ACTS = [('01_monster_idle', 'idle'), ('02_monster_chase', 'chase'), ('03_monster_pounce', 'pounce'),
             ('04_monster_claw', 'claw'), ('05_monster_crouch', 'crouch')]


def gen_duli(f=4, prefix='duli', sharp=0.5, edge=0.8):
    out = {}
    base = os.path.join(ROOT, 'duli', 'frames')
    for src, name in DULI_ACTS:
        d = os.path.join(base, src)
        for i, fn in enumerate(sorted(os.listdir(d))):
            a = load(os.path.join(d, fn))
            sx, sy = duli_anchor(src, i, measure(a))
            out[f'{prefix}/{name}/{i}'] = convert(a, sx, sy, f, sharp, edge)
    return out


def gen_all():
    out = {}
    out.update(gen_hero(4, 'hero'))
    out.update(gen_duli(4, 'duli'))
    # 大号版本：标题画面的张震立绘、首领「嘟礼·暴君」
    out.update(gen_hero(2, 'herox', acts=('idle',), sharp=0.35, edge=0.55))
    out.update(gen_duli(2, 'dulix', sharp=0.35, edge=0.55))
    return out


if __name__ == '__main__':
    import sys
    from px import preview
    sprites = gen_all()
    outdir = sys.argv[1] if len(sys.argv) > 1 else '.'
    for pre, cols, zoom in (('hero/', 11, 4), ('duli/', 8, 4), ('dulix/', 8, 2), ('herox/', 6, 2)):
        items = [(k, v) for k, v in sprites.items() if k.startswith(pre)]
        # 以锚点对齐排版，便于观察动画是否稳定
        maxl = max(s.ax for _, s in items)
        maxr = max(s.w - s.ax for _, s in items)
        maxt = max(s.ay for _, s in items)
        maxb = max(s.h - s.ay for _, s in items)
        cw, ch = maxl + maxr + 2, maxt + maxb + 3
        aligned = []
        for k, s in items:
            c = np.zeros((ch, cw, 4), np.uint8)
            c[maxt + 1, :, :] = (90, 96, 120, 255)      # 地面线
            c[:, maxl + 1, :] = (90, 96, 120, 255)      # 锚点竖线
            m = s.arr[..., 3] > 0
            y0, x0 = maxt + 1 - s.ay, maxl + 1 - s.ax
            c[y0:y0 + s.h, x0:x0 + s.w][m] = s.arr[m]
            aligned.append(Sprite(c))
        # 按动作换行
        rows = {}
        for (k, _), s in zip(items, aligned):
            rows.setdefault(k.split('/')[1], []).append(s)
        flat = []
        for act, lst in rows.items():
            flat += lst + [Sprite(np.zeros((ch, cw, 4), np.uint8))] * (cols - len(lst))
        size = preview(flat, os.path.join(outdir, pre.strip('/') + '_frames.png'), zoom=zoom, cols=cols, cell=(cw, ch))
        print(pre, len(items), 'cell', cw, ch, 'sheet', size)
        for k, s in items[:3]:
            print('  ', k, s.w, s.h, s.ax, s.ay)
