// 光照：环境暗色 + 叠加光斑（分级的像素风光晕），用 multiply 合成到画面
import { W, H } from '../core/config.js';

const sprites = new Map();

/** 生成分级圆形光斑（中心亮、向外分 5 级衰减） */
function lightSprite(r, color) {
  const key = r + color;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const g = c.getContext('2d');
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const rr = Math.round(r * (1 - i / steps));
    g.globalAlpha = 0.03 + i * 0.019;
    g.fillStyle = color;
    // 像素圆
    for (let y = -rr; y <= rr; y++) {
      const w = Math.floor(Math.sqrt(rr * rr - y * y));
      g.fillRect(r - w, r + y, w * 2, 1);
    }
  }
  sprites.set(key, c);
  return c;
}

export class Lighting {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.ambient = '#787896';
    this.queue = [];
  }

  begin(ambient) {
    // 视口宽度会随屏幕比例变化
    if (this.canvas.width !== W) this.canvas.width = W;
    this.ambient = ambient;
    this.queue.length = 0;
  }

  /** 屏幕坐标的光源 */
  add(x, y, r, color = '#ffe2b0', intensity = 1) {
    if (x < -r || y < -r || x > W + r || y > H + r) return;
    this.queue.push(x, y, r, color, intensity);
  }

  render(ctx) {
    const g = this.ctx;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = this.ambient;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const q = this.queue;
    for (let i = 0; i < q.length; i += 5) {
      const r = Math.max(8, Math.round(q[i + 2] / 8) * 8);
      g.globalAlpha = Math.max(0, Math.min(1, q[i + 4]));
      g.drawImage(lightSprite(r, q[i + 3]), Math.round(q[i] - r), Math.round(q[i + 1] - r));
    }
    g.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** 直接在主画面上叠一层加色辉光（发光体用） */
export function drawGlow(ctx, x, y, r, color, alpha = 0.5) {
  if (x < -r || y < -r || x > W + r || y > H + r) return;
  r = Math.max(8, Math.round(r / 8) * 8);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(lightSprite(r, color), Math.round(x - r), Math.round(y - r));
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
