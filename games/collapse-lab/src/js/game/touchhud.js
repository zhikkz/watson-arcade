// 触屏按键的绘制：像素风的摇杆与圆键，直接画在游戏画面里（命中判定在 core/touch.js）
import { H } from '../core/config.js';
import { clamp } from '../core/util.js';
import { drawText, drawTextBig } from '../core/font.js';
import { drawSprite, drawSpriteScaled, hasSprite, frame } from '../core/assets.js';
import { touch } from '../core/touch.js';
import { G } from './state.js';
import { ITEMS } from './items.js';

const INK = '#14101a';
const INK_RGB = [20, 16, 26];
const cache = new Map();

function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }

/** 像素圆盘：深色描边 + 彩色环 + 半透明底；按下时底色变亮、环变白 */
function disc(r, color, on, fillA = 120) {
  const key = r + color + (on ? '1' : '0') + fillA;
  let c = cache.get(key);
  if (c) return c;
  const o = r + 2, s = o * 2 + 1;
  c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const img = g.createImageData(s, s), d = img.data;
  const col = rgb(color);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dist = Math.hypot(x - o, y - o);
    let px = null, a = 0;
    if (dist <= r - 2.5) {
      px = on ? mix(col, INK_RGB, 0.5) : INK_RGB; a = on ? 215 : fillA;
      // 上半边一点高光，让圆键有「凸起」的感觉
      if (!on && y - o < -r * 0.35 && dist > r - 6.5) { px = mix(INK_RGB, col, 0.35); a = fillA + 30; }
    } else if (dist <= r - 0.5) { px = on ? [255, 255, 255] : col; a = on ? 255 : 220; } else if (dist <= r + 0.8) { px = INK_RGB; a = 200; }
    if (px) { const i = (y * s + x) * 4; d[i] = px[0]; d[i + 1] = px[1]; d[i + 2] = px[2]; d[i + 3] = a; }
  }
  g.putImageData(img, 0, 0);
  if (cache.size > 80) cache.clear();
  cache.set(key, c);
  return c;
}

function drawDisc(ctx, cx, cy, r, color, on, fillA) { ctx.drawImage(disc(r, color, on, fillA), cx - r - 2, cy - r - 2); }

/** 冷却遮罩：从上往下盖住圆键内部的一部分 */
function cooldown(ctx, cx, cy, r, k) {
  if (k <= 0) return;
  const rr = r - 2.5, n = Math.round((rr * 2) * clamp(k, 0, 1));
  ctx.globalAlpha = 0.66; ctx.fillStyle = INK;
  for (let i = 0; i < n; i++) {
    const dy = -Math.floor(rr) + i;
    const hw = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
    ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
  ctx.globalAlpha = 1;
}

/** 把图集里的图标按中心对齐画出来 */
function iconCentered(ctx, name, cx, cy, scale = 1, alpha = 1) {
  if (!hasSprite(name)) return false;
  const f = frame(name);
  const x = Math.round(cx - (f[2] / 2 - f[4]) * scale), y = Math.round(cy - (f[3] / 2 - f[5]) * scale);
  if (scale === 1) drawSprite(ctx, name, x, y, false, alpha); else drawSpriteScaled(ctx, name, x, y, scale, false, alpha);
  return true;
}

function bigLabel(ctx, text, cx, cy, color) {
  // drawTextBig 的画布是 (字高 + 4) × 2 高
  drawTextBig(ctx, text, cx, cy - 16, 2, { color, outline: INK, align: 'center' });
}

function tri(ctx, x, y, dir) {
  // 小三角：dir = -1 朝左，1 朝右
  for (let i = 0; i < 4; i++) ctx.fillRect(x + dir * i, y - (3 - i), 1, (3 - i) * 2 + 1);
}

/** 装备键：图标 + 等级 + 冷却 */
function equipButton(ctx, b, cx, cy, item, cd, cdMax, emptyLabel) {
  const on = b.pid !== null;
  drawDisc(ctx, cx, cy, b.r, b.color, on);
  if (!item) {
    drawText(ctx, emptyLabel, cx, cy - 6, { size: 12, color: '#6a7088', align: 'center', outline: INK });
    return;
  }
  const def = ITEMS[item.id];
  if (!iconCentered(ctx, def.icon, cx, cy, 2)) { ctx.fillStyle = def.color || '#8a90a8'; ctx.fillRect(cx - 7, cy - 7, 14, 14); }
  if (cd > 0.05 && cdMax > 0) {
    cooldown(ctx, cx, cy, b.r, cd / cdMax);
    if (cd >= 1) drawText(ctx, String(Math.ceil(cd)), cx, cy - 6, { size: 12, color: '#ffffff', align: 'center', outline: INK });
  }
  drawText(ctx, String(item.lv), cx + Math.round(b.r * 0.62), cy + Math.round(b.r * 0.34), { size: 8, color: '#ffe9a0', align: 'center', outline: INK });
}

export function drawTouchControls(ctx, run, world) {
  const p = world.player;
  const locked = world.inputLocked || p.dead;
  touch.showInteract = !!world.interactTarget && !locked;
  const base = locked ? 0.35 : 1;

  // ---------------- 摇杆（左半屏任意位置按下即出现在手指下）
  const s = touch.stick, active = s.pid !== null;
  const home = touch.home();
  const sx = active ? Math.round(s.ox) : home.x, sy = active ? Math.round(s.oy) : home.y;
  ctx.globalAlpha = base * (active ? 0.95 : 0.5);
  drawDisc(ctx, sx, sy, 36, '#8a90a8', false, 70);
  ctx.fillStyle = active ? '#e8ecf4' : '#aab0c4';
  tri(ctx, sx - 24, sy, -1); tri(ctx, sx + 24, sy, 1);
  // 下方向的小箭头（下跳 / 下砸）
  for (let i = 0; i < 4; i++) ctx.fillRect(sx - (3 - i), sy + 24 + i, (3 - i) * 2 + 1, 1);
  const kx = sx + Math.round(s.dx), ky = sy + Math.round(s.dy);
  ctx.globalAlpha = base * (active ? 1 : 0.6);
  drawDisc(ctx, kx, ky, 15, '#62e6ff', active, 150);
  ctx.globalAlpha = 1;

  // ---------------- 圆键
  for (const b of touch.buttons) {
    if (b.contextual && !touch.showInteract) continue;
    const { x: cx, y: cy } = touch.pos(b);
    const on = b.pid !== null;
    ctx.globalAlpha = base * (on ? 1 : 0.88);
    switch (b.id) {
      case 'atk1': equipButton(ctx, b, cx, cy, run.weapons[0], run.wcd[0], 0.5, '主'); break;
      case 'atk2': equipButton(ctx, b, cx, cy, run.weapons[1], run.wcd[1], 0.5, '副'); break;
      case 'skill': equipButton(ctx, b, cx, cy, run.skill, run.skillCd, run.skillCdMax, '技'); break;
      case 'jump': drawDisc(ctx, cx, cy, b.r, b.color, on); bigLabel(ctx, '跳', cx, cy, '#dff8ff'); break;
      case 'roll': drawDisc(ctx, cx, cy, b.r, b.color, on); bigLabel(ctx, '滚', cx, cy, '#e2ffe2'); break;
      case 'heal': {
        const has = run.flask > 0;
        if (!has) ctx.globalAlpha = base * 0.5;
        drawDisc(ctx, cx, cy, b.r, has ? '#7be07b' : '#6a7088', on);
        const spr = has ? 'ui/flask_on' : 'ui/flask_off';
        if (!iconCentered(ctx, spr, cx - 4, cy)) { ctx.fillStyle = has ? '#7be07b' : '#3a4050'; ctx.fillRect(cx - 8, cy - 7, 8, 13); }
        drawText(ctx, String(run.flask), cx + 6, cy - 4, { size: 10, color: has ? '#ffffff' : '#9aa0b4', align: 'center', outline: INK });
        break;
      }
      case 'interact': {
        const bob = Math.floor(G.time * 3) % 2;
        drawDisc(ctx, cx, cy - bob, b.r, b.color, on);
        drawText(ctx, '互动', cx, cy - 5 - bob, { size: 10, color: '#fff4c8', align: 'center', outline: INK });
        break;
      }
      case 'pause':
        ctx.globalAlpha = on ? 1 : 0.75;
        drawDisc(ctx, cx, cy, b.r, b.color, on);
        ctx.fillStyle = '#e8ecf4'; ctx.fillRect(cx - 3, cy - 4, 2, 9); ctx.fillRect(cx + 2, cy - 4, 2, 9);
        break;
      default: break;
    }
    ctx.globalAlpha = 1;
  }
}
