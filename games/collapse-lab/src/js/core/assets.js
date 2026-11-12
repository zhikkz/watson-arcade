// 图集加载与精灵绘制（全部整像素 blit）
const A = {
  img: null,        // 图集 <img>
  frames: null,     // name -> [x, y, w, h, ax, ay]
  fontImg: null,
  font: null,
  sil: new Map(),   // color -> 剪影图集 canvas
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('image load failed'));
    im.src = src;
  });
}

export async function loadAssets() {
  const data = window.__CL_ASSETS__;
  if (!data) throw new Error('assets missing');
  A.frames = data.atlas.frames;
  A.font = data.font;
  [A.img, A.fontImg] = await Promise.all([loadImage(data.atlasPng), loadImage(data.fontPng)]);
  return A;
}

export const assets = A;

export function hasSprite(name) { return !!A.frames[name]; }

export function frame(name) {
  const f = A.frames[name];
  if (!f) {
    if (!frame.warned) frame.warned = new Set();
    if (!frame.warned.has(name)) { frame.warned.add(name); console.warn('missing sprite', name); }
    return A.frames['hero/idle/0'];
  }
  return f;
}

/** 以锚点为基准绘制；flip 为水平翻转 */
export function drawSprite(ctx, name, x, y, flip = false, alpha = 1) {
  drawFrom(ctx, A.img, frame(name), x, y, flip, alpha);
}

function drawFrom(ctx, img, f, x, y, flip, alpha) {
  x = Math.round(x); y = Math.round(y);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.setTransform(-1, 0, 0, 1, x, y);
    ctx.drawImage(img, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    ctx.drawImage(img, f[0], f[1], f[2], f[3], x - f[4], y - f[5], f[2], f[3]);
  }
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/** 某一帧的单色剪影（受击闪白、状态染色用）。按「颜色 + 帧」缓存成小画布，省内存 */
function silFrame(name, color) {
  const key = color + '|' + name;
  let e = A.sil.get(key);
  if (!e) {
    const f = frame(name);
    const c = document.createElement('canvas');
    c.width = f[2]; c.height = f[3];
    const g = c.getContext('2d');
    g.drawImage(A.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, f[2], f[3]);
    e = { c, f: [0, 0, f[2], f[3], f[4], f[5]] };
    if (A.sil.size > 900) A.sil.clear();
    A.sil.set(key, e);
  }
  return e;
}

export function drawSil(ctx, name, x, y, flip, color, alpha = 1) {
  const e = silFrame(name, color);
  drawFrom(ctx, e.c, e.f, x, y, flip, alpha);
}

/** 缩放绘制（UI 图标放大等），锚点同样生效 */
export function drawSpriteScaled(ctx, name, x, y, scale, flip = false, alpha = 1, silColor = null) {
  const f = frame(name);
  x = Math.round(x); y = Math.round(y);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.setTransform(flip ? -scale : scale, 0, 0, scale, x, y);
  if (silColor) { const e = silFrame(name, silColor); ctx.drawImage(e.c, 0, 0, f[2], f[3], -f[4], -f[5], f[2], f[3]); } else ctx.drawImage(A.img, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/** 旋转绘制（武器挥舞、飞行道具），以锚点为轴 */
export function drawSpriteRot(ctx, name, x, y, angle, flip = false, alpha = 1, scale = 1) {
  const f = frame(name);
  const c = Math.cos(angle), s = Math.sin(angle);
  const fx = flip ? -1 : 1;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.setTransform(c * scale * fx, s * scale, -s * scale * fx, c * scale, Math.round(x), Math.round(y));
  ctx.drawImage(A.img, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/** 不考虑锚点，直接按左上角绘制（瓦片） */
export function drawTile(ctx, name, x, y) {
  const f = frame(name);
  ctx.drawImage(A.img, f[0], f[1], f[2], f[3], x, y, f[2], f[3]);
}

/** 动画帧序列助手：frames('hero/run', 6) -> ['hero/run/0', ...] */
export function seq(prefix, n, start = 0) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(`${prefix}/${start + i}`);
  return out;
}
