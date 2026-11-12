// HUD：生命、保温杯、装备槽、货币、小地图、首领血条、区域横幅
import { W, H, COLORS } from '../core/config.js';
import { clamp } from '../core/util.js';
import { drawText, textWidth } from '../core/font.js';
import { drawSprite, hasSprite } from '../core/assets.js';
import { input } from '../core/input.js';
import { touch } from '../core/touch.js';
import { drawTouchControls } from './touchhud.js';
import { G } from './state.js';
import { ITEMS, itemColor } from './items.js';

function panel(ctx, x, y, w, h, fill = '#1a1826', edge = '#14101a', hi = '#3a3850') {
  ctx.fillStyle = edge; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = hi; ctx.fillRect(x + 1, y + 1, w - 2, 1);
}

export function drawIcon(ctx, name, x, y, fallbackColor = '#8a90a8') {
  if (hasSprite(name)) drawSprite(ctx, name, x, y);
  else { ctx.fillStyle = fallbackColor; ctx.fillRect(x - 6, y - 12, 12, 12); ctx.fillStyle = '#14101a'; ctx.fillRect(x - 4, y - 10, 8, 8); }
}

export class HUD {
  constructor() { this.hpLag = 1; this.banner = null; this.bossLag = 1; this.msg = null; }

  showBanner(title, sub) { this.banner = { title, sub, t: 0 }; }
  toast(text, color = '#ffffff') { this.msg = { text, color, t: 0 }; }
  /** 自动存档的小提示（血条下方，不挡画面） */
  flashSaved() { this.savedT = 3; }

  update(dt) {
    // 提示条在标题 / 菜单里也要走时间
    if (this.msg) { this.msg.t += dt; if (this.msg.t > 2.6) this.msg = null; }
    const run = G.run;
    if (!run) return;
    const k = run.hp / run.maxHp;
    this.hpLag += (k - this.hpLag) * Math.min(1, dt * 4);
    if (this.hpLag < k) this.hpLag = k;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 3.4) this.banner = null; }
    if (this.savedT > 0) this.savedT -= dt;
    const w = G.world;
    if (w && w.boss) { const bk = w.boss.hp / w.boss.maxHp; this.bossLag += (bk - this.bossLag) * Math.min(1, dt * 3); if (this.bossLag < bk) this.bossLag = bk; } else this.bossLag = 1;
  }

  draw(ctx) {
    const run = G.run, w = G.world;
    if (!run || !w) return;
    const touchMode = input.device === 'touch';
    // ---------------- 生命
    const bx = 8, by = 8, bw = 132, bh = 12;
    panel(ctx, bx, by, bw, bh, '#2a1420');
    const k = clamp(run.hp / run.maxHp, 0, 1);
    ctx.fillStyle = '#f0e0c0'; ctx.fillRect(bx + 2, by + 2, Math.round((bw - 4) * clamp(this.hpLag, 0, 1)), bh - 4);
    ctx.fillStyle = k < 0.3 && Math.floor(G.time * 6) % 2 ? '#ff8a80' : COLORS.hp; ctx.fillRect(bx + 2, by + 2, Math.round((bw - 4) * k), bh - 4);
    ctx.fillStyle = '#ff9a94'; ctx.fillRect(bx + 2, by + 2, Math.round((bw - 4) * k), 2);
    if (w.player.shield > 0) { ctx.fillStyle = '#62e6ff'; ctx.fillRect(bx + 2, by + bh - 4, Math.round((bw - 4) * clamp(w.player.shield / 20, 0, 1)), 2); }
    drawText(ctx, `${Math.max(0, Math.ceil(run.hp))}/${run.maxHp}`, bx + bw / 2, by + 2, { size: 8, color: '#ffffff', align: 'center', shadow: '#14101a' });
    // ---------------- 保温杯
    for (let i = 0; i < run.flaskMax; i++) {
      const fx = bx + bw + 6 + i * 13, fy = by + 13;
      if (hasSprite('ui/flask_on')) drawSprite(ctx, i < run.flask ? 'ui/flask_on' : 'ui/flask_off', fx + 5, fy);
      else { ctx.fillStyle = '#14101a'; ctx.fillRect(fx, fy - 13, 10, 13); ctx.fillStyle = i < run.flask ? '#7be07b' : '#3a4050'; ctx.fillRect(fx + 1, fy - 12, 8, 11); }
    }
    // ---------------- 状态
    let sx = bx;
    const st = w.player.status;
    const sty = by + 16;
    if (st.burn > 0) { drawText(ctx, '灼烧', sx, sty, { size: 8, color: COLORS.burn, outline: '#14101a' }); sx += 22; }
    if (st.chill > 0) { drawText(ctx, '寒冷', sx, sty, { size: 8, color: COLORS.freeze, outline: '#14101a' }); sx += 22; }
    // ---------------- 自动存档提示
    if (this.savedT > 0) {
      const a = Math.min(1, this.savedT / 0.6);
      ctx.globalAlpha = a; ctx.fillStyle = '#14101a'; ctx.fillRect(bx, by + 30, 7, 7); ctx.fillStyle = '#7be07b'; ctx.fillRect(bx + 1, by + 31, 5, 5); ctx.globalAlpha = 1;
      drawText(ctx, '区域存档点已更新', bx + 11, by + 28, { size: 10, color: '#9dffb0', outline: '#14101a', alpha: a });
    }
    // ---------------- 装备槽
    const slotY = H - 34;
    const slots = [[run.weapons[0], 'atk1', run.wcd[0], 0.5], [run.weapons[1], 'atk2', run.wcd[1], 0.5], [run.skill, 'skill', run.skillCd, run.skillCdMax]];
    // 触屏：装备图标、等级和冷却直接显示在右下角的圆键上，不再单独画装备槽
    if (!touchMode) {
      slots.forEach(([item, act, cd, cdMax], i) => {
        const x = 8 + i * 30, y = slotY;
        panel(ctx, x, y, 26, 26, '#1e1c2c', '#14101a', item ? itemColor(item) : '#3a3850');
        if (item) {
          drawIcon(ctx, ITEMS[item.id].icon, x + 13, y + 22, ITEMS[item.id].color);
          if (cd > 0.05 && cdMax > 0) {
            const hh = Math.round(24 * clamp(cd / cdMax, 0, 1));
            ctx.globalAlpha = 0.72; ctx.fillStyle = '#14101a'; ctx.fillRect(x + 1, y + 1, 24, hh); ctx.globalAlpha = 1;
            if (cd >= 1) drawText(ctx, String(Math.ceil(cd)), x + 13, y + 8, { size: 10, color: '#ffffff', align: 'center', outline: '#14101a' });
          }
          drawText(ctx, String(item.lv), x + 24, y + 17, { size: 8, color: '#ffe9a0', align: 'right', outline: '#14101a' });
        }
        drawText(ctx, G.game.keyLabel(act), x + 2, y - 7, { size: 8, color: '#c8ccd6', outline: '#14101a' });
      });
    }
    // ---------------- 货币
    const mx = W - 104, my = 8, mw = 96, mh = 54;
    drawIcon(ctx, 'ui/coin', mx + 6, my + mh + 16, COLORS.gold);
    drawText(ctx, String(run.gold), mx + 14, my + mh + 6, { size: 10, color: COLORS.gold, outline: '#14101a' });
    drawIcon(ctx, 'ui/data', mx + 54, my + mh + 16, COLORS.data);
    drawText(ctx, String(run.data), mx + 62, my + mh + 6, { size: 10, color: COLORS.data, outline: '#14101a' });
    // ---------------- 小地图
    this.drawMinimap(ctx, mx, my, mw, mh);
    // ---------------- 首领血条
    if (w.boss && w.bossIntroT <= 0) {
      const b = w.boss, bw2 = 280, x = (W - bw2) / 2, y = 22;
      drawText(ctx, b.name, W / 2, y - 14, { size: 12, color: '#ffffff', align: 'center', outline: '#14101a' });
      panel(ctx, x, y, bw2, 9, '#2a1420');
      ctx.fillStyle = '#f0e0c0'; ctx.fillRect(x + 2, y + 2, Math.round((bw2 - 4) * clamp(this.bossLag, 0, 1)), 5);
      ctx.fillStyle = '#c94ad8'; ctx.fillRect(x + 2, y + 2, Math.round((bw2 - 4) * clamp(b.hp / b.maxHp, 0, 1)), 5);
      ctx.fillStyle = '#e8a0f0'; ctx.fillRect(x + 2, y + 2, Math.round((bw2 - 4) * clamp(b.hp / b.maxHp, 0, 1)), 1);
    }
    // ---------------- 区域横幅
    if (this.banner) {
      const t = this.banner.t;
      const a = t < 0.5 ? t / 0.5 : t > 2.8 ? Math.max(0, 1 - (t - 2.8) / 0.6) : 1;
      const y = 92;
      ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#0c0a14'; ctx.fillRect(0, y - 8, W, 52); ctx.globalAlpha = 1;
      const tw = textWidth(this.banner.title, 12) * 2;
      // 标题放大 2 倍：先画到临时偏移再放大会破坏整像素，这里用逐字加粗描边代替
      drawText(ctx, this.banner.title, W / 2, y, { size: 12, color: '#ffffff', align: 'center', outline: '#14101a', alpha: a });
      ctx.globalAlpha = a; ctx.fillStyle = '#ffd24a'; ctx.fillRect(Math.round(W / 2 - tw / 4 - 30), y + 17, Math.round(tw / 2 + 60), 1); ctx.globalAlpha = 1;
      if (this.banner.sub) drawText(ctx, this.banner.sub, W / 2, y + 23, { size: 10, color: '#c8ccd6', align: 'center', outline: '#14101a', alpha: a });
    }
    // ---------------- 触屏按键（菜单打开时收起）
    const mapOpen = input.down('map') || touch.mapOpen;
    if (touchMode && !G.game.ui.active && !mapOpen) drawTouchControls(ctx, run, w);
    if (mapOpen) this.drawBigMap(ctx);
  }

  /** 提示条。由 Game 在所有界面之上绘制；有菜单时挪到屏幕顶部并垫一块底色 */
  drawToast(ctx, top) {
    const m = this.msg;
    if (!m) return;
    const a = m.t < 0.2 ? m.t / 0.2 : m.t > 2 ? Math.max(0, 1 - (m.t - 2) / 0.6) : 1;
    const y = top ? 8 : H - 70;
    if (top) {
      const tw = textWidth(m.text, 12) + 24;
      ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#0c0a14'; ctx.fillRect(Math.round((W - tw) / 2), y - 4, tw, 21);
      ctx.globalAlpha = a; ctx.fillStyle = m.color; ctx.fillRect(Math.round((W - tw) / 2), y + 16, tw, 1);
      ctx.globalAlpha = 1;
    }
    drawText(ctx, m.text, W / 2, y, { size: 12, color: m.color, align: 'center', outline: '#14101a', alpha: a });
  }

  drawBigMap(ctx) {
    const world = G.world, lv = world.level, p = world.player;
    const sc = Math.max(1, Math.min(3, Math.floor(Math.min((W - 24) / lv.w, (H - 60) / lv.h))));
    const mw = lv.w * sc, mh = lv.h * sc, x = Math.round((W - mw) / 2), y = Math.round((H - mh) / 2);
    ctx.globalAlpha = 0.86; ctx.fillStyle = '#0a0812'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(world.mini, 0, 0, lv.w, lv.h, x, y, mw, mh);
    const dot = (wx, wy, col, size) => { ctx.fillStyle = col; ctx.fillRect(x + Math.floor(wx / 24) * sc - (size >> 1), y + Math.floor(wy / 24) * sc - (size >> 1), size + sc, size + sc); };
    const seen = (o) => world.explored[Math.floor((o.y - 4) / 24) * lv.w + Math.floor(o.x / 24)];
    for (const o of world.props) if (o.interactive && seen(o)) dot(o.x, o.y - 12, o.locked === undefined ? (o.open === false ? '#ffd24a' : '#62e6ff') : '#7be07b', 3);
    for (const o of world.pickups) if (o.interactive && seen(o)) dot(o.x, o.y - 8, '#ffe9a0', 2);
    dot(p.x, p.y - 20, Math.floor(G.time * 4) % 2 ? '#ffffff' : '#ff6b5e', 3);
    ctx.strokeStyle = '#3a3850'; ctx.lineWidth = 1; ctx.strokeRect(x - 2.5, y - 2.5, mw + 5, mh + 5);
    drawText(ctx, world.stageDef.name || '茶水间', W / 2, y - 22, { size: 12, color: '#ffe9a0', align: 'center', outline: '#14101a' });
    drawText(ctx, '{y}■{/} 宝箱　{c}■{/} 设施　{g}■{/} 出口　{#ffe9a0}■{/} 装备 / 文献' + (touch.mapOpen ? '　　点击任意位置收起' : ''), W / 2, y + mh + 10, { size: 10, color: '#c8ccd6', align: 'center', outline: '#14101a' });
  }

  drawMinimap(ctx, x, y, w, h) {
    const world = G.world, lv = world.level, p = world.player;
    ctx.globalAlpha = 0.78; ctx.fillStyle = '#0c0a14'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.globalAlpha = 1;
    const ptx = p.x / 24, pty = p.y / 24;
    let sx = Math.round(ptx - w / 2), sy = Math.round(pty - h / 2);
    sx = lv.w <= w ? -Math.floor((w - lv.w) / 2) : clamp(sx, 0, lv.w - w);
    sy = lv.h <= h ? -Math.floor((h - lv.h) / 2) : clamp(sy, 0, lv.h - h);
    const srcX = Math.max(0, sx), srcY = Math.max(0, sy);
    const cw = Math.min(lv.w - srcX, w - (srcX - sx)), ch = Math.min(lv.h - srcY, h - (srcY - sy));
    if (cw > 0 && ch > 0) ctx.drawImage(world.mini, srcX, srcY, cw, ch, x + (srcX - sx), y + (srcY - sy), cw, ch);
    const dot = (wx, wy, col, size = 2) => {
      const dx = Math.floor(wx / 24) - sx, dy = Math.floor(wy / 24) - sy;
      if (dx < 0 || dy < 0 || dx >= w || dy >= h) return;
      ctx.fillStyle = col; ctx.fillRect(x + dx - (size >> 1), y + dy - (size >> 1), size, size);
    };
    const seen = (o) => world.explored[Math.floor((o.y - 4) / 24) * lv.w + Math.floor(o.x / 24)];
    for (const o of world.props) {
      if (!o.interactive || !seen(o)) continue;
      dot(o.x, o.y - 12, o.locked === undefined ? (o.open === false ? '#ffd24a' : '#62e6ff') : '#7be07b', 3);
    }
    for (const o of world.pickups) if (o.interactive && seen(o)) dot(o.x, o.y - 8, '#ffe9a0', 2);
    if (Math.floor(G.time * 4) % 2) dot(p.x, p.y - 20, '#ffffff', 3); else dot(p.x, p.y - 20, '#ff6b5e', 3);
    ctx.strokeStyle = '#3a3850'; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  }
}

export { panel };
