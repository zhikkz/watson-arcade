// 关卡数据：瓦片网格、碰撞与移动、视线检测、分块渲染缓存
import { TILE, T_EMPTY, T_SOLID, T_PLAT, T_SPIKE, T_ICE, T_ACID, T_PHASE, W, H } from '../core/config.js';
import { assets, frame } from '../core/assets.js';

const CHUNK = 16;                 // 每块 16x16 格
const CPX = CHUNK * TILE;

export class Level {
  constructor(w, h, biome) {
    this.w = w; this.h = h;
    this.biome = biome;                       // 'mech' | 'em' | 'thermo' | 'quantum' | 'rest'
    this.tiles = new Uint8Array(w * h).fill(T_SOLID);
    this.back = new Uint8Array(w * h);        // 1 = 有背景墙（房间内部）
    this.decor = [];                          // 静态装饰 {spr, x, y, flip, fg, w, h}
    this.lights = [];                         // 静态光源 {x, y, r, color, flicker}
    this.movers = [];                         // 移动平台（由 world 更新）
    this.chunks = new Map();
    this.phaseOn = true;                      // 叠加态平台当前是否存在
    this.pxW = w * TILE; this.pxH = h * TILE;
    this.seed = 1;
  }

  idx(tx, ty) { return ty * this.w + tx; }
  inside(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  get(tx, ty) { return this.inside(tx, ty) ? this.tiles[ty * this.w + tx] : T_SOLID; }
  set(tx, ty, v) { if (this.inside(tx, ty)) this.tiles[ty * this.w + tx] = v; }

  isSolid(tx, ty) { const t = this.get(tx, ty); return t === T_SOLID || t === T_ICE; }
  isPlat(tx, ty) { const t = this.get(tx, ty); return t === T_PLAT || (t === T_PHASE && this.phaseOn); }
  isFloor(tx, ty) { return this.isSolid(tx, ty) || this.isPlat(tx, ty); }
  solidAt(px, py) { return this.isSolid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  floorAt(px, py) { return this.isFloor(Math.floor(px / TILE), Math.floor(py / TILE)); }
  typeAt(px, py) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)); }

  /** 矩形区域（像素）内是否有实心瓦片 */
  rectSolid(x, y, w, h) {
    const tx0 = Math.floor(x / TILE), tx1 = Math.floor((x + w - 0.001) / TILE);
    const ty0 = Math.floor(y / TILE), ty1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.isSolid(tx, ty)) return true;
    return false;
  }

  /** 矩形内是否碰到指定类型的瓦片 */
  rectTouches(x, y, w, h, type) {
    const tx0 = Math.floor(x / TILE), tx1 = Math.floor((x + w - 0.001) / TILE);
    const ty0 = Math.floor(y / TILE), ty1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.get(tx, ty) === type) return true;
    return false;
  }

  /**
   * 移动一个物理体。b: {x(中心), y(脚底), w, h, vx, vy}
   * 会写入 b.onGround / b.hitWall(-1|0|1) / b.hitCeil / b.onIce / b.ride
   * opts.noPlat: 忽略单向平台（下跳）
   */
  moveBody(b, dt, noPlat = false) {
    // 站在移动平台上：先被带着走
    if (b.ride) {
      const m = b.ride;
      if (m.dead || b.x + b.w / 2 < m.x || b.x - b.w / 2 > m.x + m.w || b.vy < -1) b.ride = null;
      else { this.moveX(b, m.dx); b.y = m.y; }
    }
    b.hitWall = 0; b.hitCeil = false;
    let dx = b.vx * dt, dy = b.vy * dt;
    // 高速时分步，防止穿透
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (TILE * 0.45)));
    dx /= n; dy /= n;
    const wasGround = b.onGround;
    b.onGround = false; b.onIce = false;
    for (let i = 0; i < n; i++) {
      if (dx) this.moveX(b, dx);
      this.moveY(b, dy, noPlat);
    }
    // 静止站立时 dy 可能为 0：探测脚下
    if (!b.onGround && dy === 0 && wasGround && this.probeGround(b, noPlat)) b.onGround = true;
    return b;
  }

  moveX(b, dx) {
    if (!dx) return;
    b.x += dx;
    const top = b.y - b.h, bottom = b.y;
    const ty0 = Math.floor(top / TILE), ty1 = Math.floor((bottom - 0.001) / TILE);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w / 2 - 0.001) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (this.isSolid(tx, ty)) { b.x = tx * TILE - b.w / 2; b.vx = 0; b.hitWall = 1; break; }
      }
    } else {
      const tx = Math.floor((b.x - b.w / 2) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (this.isSolid(tx, ty)) { b.x = (tx + 1) * TILE + b.w / 2; b.vx = 0; b.hitWall = -1; break; }
      }
    }
  }

  moveY(b, dy, noPlat) {
    const prevBottom = b.y;
    b.y += dy;
    const left = b.x - b.w / 2, right = b.x + b.w / 2;
    const tx0 = Math.floor(left / TILE), tx1 = Math.floor((right - 0.001) / TILE);
    if (dy >= 0) {
      const ty = Math.floor((b.y - 0.0001) / TILE);
      const tyPrev = Math.floor((prevBottom - 0.0001) / TILE);
      for (let y = Math.max(tyPrev, ty - 1); y <= ty; y++) {
        let landed = false;
        for (let tx = tx0; tx <= tx1; tx++) {
          const t = this.get(tx, y);
          const top = y * TILE;
          if (t === T_SOLID || t === T_ICE) {
            if (b.y > top) { landed = true; if (t === T_ICE) b.onIce = true; }
          } else if (!noPlat && (t === T_PLAT || (t === T_PHASE && this.phaseOn))) {
            if (prevBottom <= top + 0.01 && b.y >= top) landed = true;
          }
        }
        if (landed) { b.y = y * TILE; if (b.vy > 0) b.vy = 0; b.onGround = true; b.ride = null; return; }
      }
      // 移动平台（视为单向平台）
      if (!noPlat) {
        for (const m of this.movers) {
          if (m.dead) continue;
          if (right > m.x && left < m.x + m.w && prevBottom <= m.y - m.dy + 0.5 && b.y >= m.y) {
            b.y = m.y; if (b.vy > 0) b.vy = 0; b.onGround = true; b.ride = m; return;
          }
        }
      }
    } else {
      const ty = Math.floor((b.y - b.h) / TILE);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (this.isSolid(tx, ty)) { b.y = (ty + 1) * TILE + b.h; b.vy = 0; b.hitCeil = true; return; }
      }
    }
  }

  probeGround(b, noPlat) {
    const left = b.x - b.w / 2, right = b.x + b.w / 2;
    const tx0 = Math.floor(left / TILE), tx1 = Math.floor((right - 0.001) / TILE);
    const ty = Math.floor((b.y + 0.5) / TILE);
    if (Math.abs(b.y - ty * TILE) > 0.6) return false;
    for (let tx = tx0; tx <= tx1; tx++) {
      if (this.isSolid(tx, ty)) return true;
      if (!noPlat && this.isPlat(tx, ty)) return true;
    }
    if (b.ride) return true;
    return false;
  }

  /** 两点之间是否无实心遮挡 */
  los(x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.ceil(d / 10));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
  }

  /** 射线：返回首次撞到实心瓦片的距离（最大 maxD） */
  raycast(x, y, dx, dy, maxD) {
    const step = 4;
    for (let d = 0; d <= maxD; d += step) {
      if (this.solidAt(x + dx * d, y + dy * d)) {
        // 回退细化
        for (let e = d - step; e <= d; e++) if (e >= 0 && this.solidAt(x + dx * e, y + dy * e)) return e;
        return d;
      }
    }
    return maxD;
  }

  /** 从某点向下找地面高度（像素 y），找不到返回 null */
  groundBelow(x, y, maxTiles = 20) {
    const tx = Math.floor(x / TILE);
    let ty = Math.floor(y / TILE);
    for (let i = 0; i < maxTiles; i++, ty++) {
      if (this.isFloor(tx, ty)) return ty * TILE;
    }
    return null;
  }

  // ---------------------------------------------------------------- 渲染
  invalidate() { this.chunks.clear(); }

  hash(tx, ty) {
    let h = (tx * 374761393 + ty * 668265263 + this.seed * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  }

  buildChunk(cx, cy, fg) {
    const c = document.createElement('canvas');
    c.width = CPX; c.height = CPX;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const img = assets.img;
    const pre = `t/${this.biome}/`;
    const ox = cx * CPX, oy = cy * CPX;
    const blit = (name, x, y) => { const f = frame(name); g.drawImage(img, f[0], f[1], f[2], f[3], x, y, f[2], f[3]); };
    const hasDado = !!assets.frames[pre + 'dado/0'];
    let any = false;
    if (!fg) {
      // 背景墙
      for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) {
        const tx = cx * CHUNK + i, ty = cy * CHUNK + j;
        if (!this.inside(tx, ty)) continue;
        const t = this.tiles[ty * this.w + tx];
        if (t === T_SOLID || t === T_ICE) continue;
        if (!this.back[ty * this.w + tx]) continue;
        const hsh = this.hash(tx, ty);
        let name = pre + 'back/' + (hsh % 20 < 16 ? 0 : 1 + ((hsh >>> 5) % 3));
        if (hasDado) {
          if (this.isSolid(tx, ty + 1)) name = pre + 'dado_base/0';
          else if (this.isSolid(tx, ty + 2)) name = pre + 'dado_top/0';
        }
        blit(name, i * TILE, j * TILE);
        any = true;
      }
    }
    // 装饰
    for (const d of this.decor) {
      if (!!d.fg !== fg) continue;
      if (d.x + d.w < ox || d.x > ox + CPX || d.y + d.h < oy || d.y > oy + CPX) continue;
      const f = frame(d.spr);
      if (d.flip) {
        g.setTransform(-1, 0, 0, 1, d.x - ox + f[2], d.y - oy);
        g.drawImage(img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
        g.setTransform(1, 0, 0, 1, 0, 0);
      } else g.drawImage(img, f[0], f[1], f[2], f[3], d.x - ox, d.y - oy, f[2], f[3]);
      any = true;
    }
    if (!fg) {
      // 实心与平台
      for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) {
        const tx = cx * CHUNK + i, ty = cy * CHUNK + j;
        if (!this.inside(tx, ty)) continue;
        const t = this.tiles[ty * this.w + tx];
        const x = i * TILE, y = j * TILE;
        if (t === T_SOLID || t === T_ICE) {
          const hsh = this.hash(tx, ty);
          blit(pre + 'fill/' + (hsh % 4), x, y);
          const eU = !this.isSolid(tx, ty - 1) && ty > 0, eD = !this.isSolid(tx, ty + 1) && ty < this.h - 1;
          const eL = !this.isSolid(tx - 1, ty) && tx > 0, eR = !this.isSolid(tx + 1, ty) && tx < this.w - 1;
          if (eD) blit(pre + 'edge_b', x, y);
          if (eL) blit(pre + 'edge_l', x, y);
          if (eR) blit(pre + 'edge_r', x, y);
          if (eU) blit(t === T_ICE && assets.frames['t/ice_top'] ? 't/ice_top' : pre + 'edge_t/' + (hsh % 5 === 0 ? 1 : 0), x, y);
          any = true;
        } else if (t === T_PLAT) {
          const l = this.get(tx - 1, ty) === T_PLAT || this.isSolid(tx - 1, ty);
          const r = this.get(tx + 1, ty) === T_PLAT || this.isSolid(tx + 1, ty);
          blit(pre + 'plat/' + (!l ? 'l' : !r ? 'r' : 'm'), x, y);
          any = true;
        } else if (t === T_SPIKE) {
          blit(pre + 'spike', x, y);
          any = true;
        }
      }
    }
    return any ? c : null;
  }

  drawLayer(ctx, camX, camY, fg) {
    const cx0 = Math.floor(camX / CPX), cx1 = Math.floor((camX + W) / CPX);
    const cy0 = Math.floor(camY / CPX), cy1 = Math.floor((camY + H) / CPX);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = (fg ? 'f' : 'b') + cx + ',' + cy;
      let c = this.chunks.get(key);
      if (c === undefined) { c = this.buildChunk(cx, cy, fg); this.chunks.set(key, c); }
      if (c) ctx.drawImage(c, cx * CPX - camX, cy * CPX - camY);
    }
  }
}

export { T_EMPTY, T_SOLID, T_PLAT, T_SPIKE, T_ICE, T_ACID, T_PHASE };
