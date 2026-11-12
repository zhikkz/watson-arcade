// 相机：平滑跟随 + 朝向前瞻 + 震屏 + 区域锁定（首领房）
import { W, H, TILE, CELL_H } from '../core/config.js';
import { clamp } from '../core/util.js';

export class Camera {
  constructor(level) {
    this.level = level;
    this.x = 0; this.y = 0;
    this.lookX = 0;
    this.shakeT = 0; this.shakeMag = 0;
    this.sx = 0; this.sy = 0;
    this.lock = null;      // {x0, y0, x1, y1} 像素范围
    this.punchX = 0; this.punchY = 0;
  }

  snap(tx, ty) {
    this.x = tx - W / 2; this.y = ty - H * 0.66;
    const g = this.level.grid;
    if (g && g.h > 1) { const cellH = CELL_H * TILE; this.y = Math.floor((ty - 25) / cellH) * cellH; }
    this.clampToBounds();
  }

  clampToBounds() {
    let x0 = 0, y0 = 0, x1 = this.level.pxW, y1 = this.level.pxH;
    if (this.lock) { x0 = this.lock.x0; y0 = this.lock.y0; x1 = this.lock.x1; y1 = this.lock.y1; }
    this.x = x1 - x0 <= W ? x0 + (x1 - x0 - W) / 2 : clamp(this.x, x0, x1 - W);
    this.y = y1 - y0 <= H ? y0 + (y1 - y0 - H) / 2 : clamp(this.y, y0, y1 - H);
  }

  shake(mag, dur = 0.2) {
    if (mag >= this.shakeMag || this.shakeT <= 0) { this.shakeMag = mag; this.shakeT = dur; this.shakeDur = dur; }
  }

  punch(dx, dy) { this.punchX += dx; this.punchY += dy; }

  update(dt, p, shakeEnabled = true) {
    // 朝向前瞻
    const targetLook = p.facing * 34 + clamp(p.vx * 0.12, -24, 24);
    this.lookX += (targetLook - this.lookX) * Math.min(1, dt * 3.2);
    const tx = p.x + this.lookX - W / 2;
    const kx = 1 - Math.exp(-9 * dt);
    this.x += (tx - this.x) * kx;
    const g = this.level.grid;
    if (g && g.h > 1) {
      // 程序关卡：每个房间正好一屏高，纵向按房间对齐
      const cellH = CELL_H * TILE;
      const ty = Math.floor((p.y - p.h * 0.5) / cellH) * cellH;
      this.y += (ty - this.y) * (1 - Math.exp(-11 * dt));
      if (Math.abs(ty - this.y) < 0.5) this.y = ty;
    } else {
      const ty = p.y - H * 0.66 + (p.lookDown ? 46 : 0);
      const ky = 1 - Math.exp(-(p.onGround ? 7 : 11) * dt);
      // 纵向：留一个死区，小跳不晃镜头
      const dy = ty - this.y;
      if (Math.abs(dy) > 10 || p.onGround) this.y += dy * ky;
    }
    this.clampToBounds();
    this.punchX *= Math.max(0, 1 - 12 * dt); this.punchY *= Math.max(0, 1 - 12 * dt);
    if (this.shakeT > 0 && shakeEnabled) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / (this.shakeDur || 0.2));
      this.sx = (Math.random() * 2 - 1) * this.shakeMag * k;
      this.sy = (Math.random() * 2 - 1) * this.shakeMag * k;
    } else { this.sx = this.sy = 0; this.shakeMag = 0; }
  }

  get vx() { return Math.round(this.x + this.sx + this.punchX); }
  get vy() { return Math.round(this.y + this.sy + this.punchY); }
}
