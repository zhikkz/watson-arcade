// 菜单与弹窗界面
// 所有界面按 640×360 设计，画在一张离屏画布上再居中贴到主画面；
// 主画面更宽时（手机铺满屏幕），整屏的底色 / 暗化会铺满两侧。
import { W as VW, H, COLORS, UI_W as W, VIEW } from '../core/config.js';
import { input } from '../core/input.js';
import { touch } from '../core/touch.js';
import { audio } from '../core/audio.js';
import { clamp, fmtTime } from '../core/util.js';
import { drawText, drawTextBig, textHeight, textWidth } from '../core/font.js';
import { drawSprite, drawSil, hasSprite, drawSpriteScaled } from '../core/assets.js';
import { writeSave, saveStatus } from '../core/save.js';
import { G } from './state.js';
import { ITEMS, AFFIXES, itemDmg, itemColor, itemTitle, KIND_LABEL } from './items.js';
import { PERKS, SCROLLS } from './perks.js';
import { META, metaAvailable } from './meta.js';
import { BESTIARY } from './enemy.js';
import { STAGES } from './run.js';
import { ItemPickup, Food } from './props.js';
import { panel, drawIcon } from './hud.js';

const INK = '#14101a';

// 整屏底色：先记下来，由 UI.draw 在主画面上铺满整个宽度（含两侧）
const BACK = [];
function dim(ctx, a = 0.62) { BACK.push(['#0a0812', a]); }
function solid(color) { BACK.push([color, 1]); }

const isTouch = () => input.device === 'touch';
/** 底部的操作提示：键盘 / 手柄一套说法，触屏一套说法 */
const hint = (keys, tap) => (isTouch() ? tap : keys);

function box(ctx, x, y, w, h, sel = false, color = '#3a3850') {
  ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = sel ? '#2a2840' : '#1c1a2a'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = sel ? '#ffd24a' : color;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  if (sel) { ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 2, y - 2, 4, 1); ctx.fillRect(x - 2, y - 2, 1, 4); ctx.fillRect(x + w - 2, y + h + 1, 4, 1); ctx.fillRect(x + w + 1, y + h - 2, 1, 4); }
}

class Screen {
  constructor(ui) { this.ui = ui; this.game = ui.game; this.t = 0; this.sel = 0; this.pausesWorld = true; }
  update(dt) { this.t += dt; }
  draw() {}
  close() { this.ui.remove(this); }
  /** 能否「返回」（触屏会在右上角画一个返回键） */
  get canBack() { return false; }
  back() { audio.sfx('back'); this.close(); }
  /** 通用的选择移动：返回是否发生变化 */
  nav(n, horizontal = false) {
    if (n <= 0) return false;
    const prev = this.sel;
    if (input.pressed(horizontal ? 'left' : 'up')) this.sel = (this.sel + n - 1) % n;
    if (input.pressed(horizontal ? 'right' : 'down')) this.sel = (this.sel + 1) % n;
    if (this.sel !== prev) audio.sfx('move');
    return this.sel !== prev;
  }
  /** 注册点击区域：悬停即选中，点击即确认 */
  /** twoStep：触屏上第一次点只是选中（看清说明），第二次点同一项才确认 */
  hot(x, y, w, h, index, onClick, twoStep = false) { this.ui.regions.push({ x, y, w, h, screen: this, index, onClick, twoStep }); }
}

// ---------------------------------------------------------------- 物品卡片
function itemLines(item) {
  const def = ITEMS[item.id];
  const lines = [];
  const kind = def.kind === 'skill' ? '技能' : KIND_LABEL[def.type] || '武器';
  lines.push(`{d}${kind} · 等级 ${item.lv}{/}`);
  if (def.kind === 'skill') lines.push(`威力 {y}${Math.round(itemDmg(item))}{/}　冷却 {y}${def.cd}{/} 秒`);
  else lines.push(`伤害 {y}${Math.round(itemDmg(item))}{/}${def.combo ? `　连段 {y}${def.combo.length}{/}` : ''}`);
  lines.push(def.desc);
  for (const a of item.affixes) lines.push(`{g}◆ ${AFFIXES[a].name}：${AFFIXES[a].desc}{/}`);
  return lines;
}

function drawItemCard(ctx, item, x, y, w, sel, title) {
  const def = ITEMS[item.id];
  const lines = itemLines(item);
  let h = 30;
  for (const l of lines) h += textHeight(l, 10, w - 16) + 4;
  box(ctx, x, y, w, h, sel, itemColor(item));
  if (title) drawText(ctx, title, x + w / 2, y - 12, { size: 10, color: '#9aa0b4', align: 'center', outline: INK });
  drawIcon(ctx, def.icon, x + 16, y + 24, def.color);
  drawText(ctx, itemTitle(item), x + 30, y + 8, { size: 12, color: itemColor(item), shadow: INK });
  let cy = y + 28;
  for (const l of lines) { cy += drawText(ctx, l, x + 8, cy, { size: 10, color: '#dfe3ee', maxWidth: w - 16 }) + 2; }
  return h;
}

// ---------------------------------------------------------------- 拾取 / 对比
class PickupScreen extends Screen {
  constructor(ui, pickup) {
    super(ui);
    this.pickup = pickup; this.item = pickup.item;
    const def = ITEMS[this.item.id];
    this.isSkill = def.kind === 'skill';
    this.opts = this.isSkill ? [['装备为技能', 'skill'], ['先不要', null]] : [['装到主手', 0], ['装到副手', 1], ['先不要', null]];
  }
  update(dt) {
    super.update(dt);
    this.nav(this.opts.length, true);
    if (input.menuCancel()) { this.back(); return; }
    if (input.menuConfirm() && this.t > 0.15) this.choose(this.sel);
  }
  get canBack() { return true; }
  choose(i) {
    const run = G.run, w = G.world, p = w.player;
    const slot = this.opts[i][1];
    if (slot === null) { audio.sfx('back'); this.close(); return; }
    if (this.pickup.price) {
      if (run.gold < this.pickup.price) { audio.sfx('deny'); return; }
      run.gold -= this.pickup.price; audio.sfx('buy');
    }
    let old = null;
    if (slot === 'skill') { old = run.skill; run.skill = this.item; run.skillCd = 0; } else { old = run.weapons[slot]; run.weapons[slot] = this.item; run.wcd[slot] = 0; }
    if (old) w.addPickup(new ItemPickup(p.x, p.y - 10, old, { pop: true }));
    this.pickup.taken();
    audio.sfx('equip');
    w.fx.ring(p.x, p.cy, itemColor(this.item), 4, 30, 0.3);
    this.game.hud.toast('装备了 ' + itemTitle(this.item), itemColor(this.item));
    this.close();
  }
  draw(ctx) {
    dim(ctx);
    const run = G.run;
    drawText(ctx, this.pickup.price ? `购买装备 · {y}${this.pickup.price} 经费{/}` : '发现装备', W / 2, 16, { size: 12, color: '#ffffff', align: 'center', outline: INK });
    const cw = 196;
    drawItemCard(ctx, this.item, 20, 52, cw, false, '新装备');
    // 当前持有
    const cur = this.isSkill ? [run.skill] : [run.weapons[0], run.weapons[1]];
    const labels = this.isSkill ? ['当前技能'] : ['当前主手', '当前副手'];
    cur.forEach((it, i) => {
      const x = 20 + (cw + 12) * (i + 1);
      const hl = this.opts[this.sel][1] === (this.isSkill ? 'skill' : i);
      if (it) drawItemCard(ctx, it, x, 52, cw, hl, labels[i]);
      else { box(ctx, x, 52, cw, 60, hl); drawText(ctx, labels[i], x + cw / 2, 40, { size: 10, color: '#9aa0b4', align: 'center', outline: INK }); drawText(ctx, '（空）', x + cw / 2, 76, { size: 12, color: '#6a7088', align: 'center' }); }
    });
    // 选项
    const n = this.opts.length, bw = 120, gap = 14, total = n * bw + (n - 1) * gap;
    this.opts.forEach(([label], i) => {
      const x = (W - total) / 2 + i * (bw + gap), y = H - 54;
      box(ctx, x, y, bw, 24, i === this.sel);
      drawText(ctx, label, x + bw / 2, y + 6, { size: 12, color: i === this.sel ? '#ffd24a' : '#ffffff', align: 'center' });
      this.hot(x, y, bw, 24, i, () => this.choose(i));
    });
    drawText(ctx, hint('←/→ 选择　确认键 决定　翻滚键 取消', '点选上面的按钮决定'), W / 2, H - 20, { size: 10, color: '#9aa0b4', align: 'center', outline: INK });
  }
}

// ---------------------------------------------------------------- 三选一卡片（文献 / 定理）
class ChoiceScreen extends Screen {
  constructor(ui, title, sub, cards, onPick, canCancel = true) {
    super(ui);
    this.title = title; this.sub = sub; this.cards = cards; this.onPick = onPick; this.canCancel = canCancel;
    this.sel = Math.min(1, cards.length - 1);
  }
  update(dt) {
    super.update(dt);
    this.nav(this.cards.length, true);
    if (this.canCancel && input.menuCancel()) { this.back(); return; }
    if (input.menuConfirm() && this.t > 0.25) this.pick(this.sel);
  }
  get canBack() { return this.canCancel; }
  pick(i) { this.close(); this.onPick(this.cards[i], i); }
  draw(ctx) {
    dim(ctx);
    drawText(ctx, this.title, W / 2, 26, { size: 12, color: '#ffe9a0', align: 'center', outline: INK });
    if (this.sub) drawText(ctx, this.sub, W / 2, 44, { size: 10, color: '#c8ccd6', align: 'center', outline: INK });
    const n = this.cards.length, cw = 176, ch = 186, gap = 16, total = n * cw + (n - 1) * gap;
    this.cards.forEach((c, i) => {
      const sel = i === this.sel;
      const x = (W - total) / 2 + i * (cw + gap), y = 72 - (sel ? 4 : 0);
      box(ctx, x, y, cw, ch, sel, c.color || '#3a3850');
      ctx.fillStyle = c.color || '#3a3850'; ctx.globalAlpha = 0.25; ctx.fillRect(x + 1, y + 1, cw - 2, 44); ctx.globalAlpha = 1;
      if (hasSprite(c.icon)) drawSpriteScaled(ctx, c.icon, x + cw / 2, y + 42, 2); else drawIcon(ctx, c.icon, x + cw / 2, y + 36, c.color || '#8a90a8');
      drawText(ctx, c.name, x + cw / 2, y + 52, { size: 12, color: c.color || '#ffffff', align: 'center', shadow: INK });
      drawText(ctx, c.desc, x + 12, y + 76, { size: 10, color: '#dfe3ee', maxWidth: cw - 24, lineGap: 4 });
      this.hot(x, y, cw, ch, i, () => this.pick(i), true);
    });
    drawText(ctx, hint(this.canCancel ? '←/→ 选择　确认键 决定　翻滚键 稍后再选' : '←/→ 选择　确认键 决定', this.canCancel ? '点一下选中，再点一次确定　·　右上角「返回」稍后再选' : '点一下选中，再点一次确定'), W / 2, H - 22, { size: 10, color: '#9aa0b4', align: 'center', outline: INK });
  }
}

// ---------------------------------------------------------------- 商店
class ShopScreen extends Screen {
  constructor(ui, vending) { super(ui); this.v = vending; }
  update(dt) {
    super.update(dt);
    const stock = this.v.stock;
    this.nav(stock.length);
    if (input.menuCancel()) { this.back(); return; }
    if (input.menuConfirm() && this.t > 0.15) this.buy(this.sel);
  }
  get canBack() { return true; }
  buy(i) {
    const run = G.run, w = G.world, p = w.player, s = this.v.stock[i];
    if (!s || s.sold) { audio.sfx('deny'); return; }
    if (run.gold < s.price) { audio.sfx('deny'); this.game.hud.toast('经费不足', '#ff6b5e'); return; }
    if (s.kind === 'flask' && run.flask >= run.flaskMax) { audio.sfx('deny'); this.game.hud.toast('保温杯已经是满的', '#9aa0b4'); return; }
    if (s.kind === 'food' && run.hp >= run.maxHp) { audio.sfx('deny'); this.game.hud.toast('生命已满', '#9aa0b4'); return; }
    run.gold -= s.price; s.sold = true; audio.sfx('buy');
    if (s.kind === 'item') { w.addPickup(new ItemPickup(this.v.x + (p.x < this.v.x ? -26 : 26), this.v.y - 20, s.item, { pop: true })); this.close(); } else if (s.kind === 'food') { run.heal(Math.round(run.maxHp * 0.35), p); audio.sfx('heal'); } else if (s.kind === 'flask') { run.flask++; audio.sfx('gulp'); }
  }
  draw(ctx) {
    dim(ctx);
    const run = G.run, stock = this.v.stock;
    drawText(ctx, '自动售货机', W / 2, 20, { size: 12, color: '#8fe8ff', align: 'center', outline: INK });
    drawText(ctx, `持有经费 {y}${run.gold}{/}`, W / 2, 38, { size: 10, color: '#c8ccd6', align: 'center', outline: INK });
    const x = 60, wd = 250;
    stock.forEach((s, i) => {
      const y = 62 + i * 46, sel = i === this.sel;
      box(ctx, x, y, wd, 40, sel, s.kind === 'item' ? itemColor(s.item) : '#3a3850');
      const name = s.kind === 'item' ? itemTitle(s.item) : s.name;
      const icon = s.kind === 'item' ? ITEMS[s.item.id].icon : s.icon;
      drawIcon(ctx, icon, x + 20, y + 30, '#8a90a8');
      drawText(ctx, name, x + 40, y + 6, { size: 12, color: s.sold ? '#6a7088' : s.kind === 'item' ? itemColor(s.item) : '#ffffff' });
      drawText(ctx, s.sold ? '已售出' : `${s.price} 经费`, x + 40, y + 23, { size: 10, color: s.sold ? '#6a7088' : run.gold >= s.price ? COLORS.gold : '#ff6b5e' });
      this.hot(x, y, wd, 40, i, () => this.buy(i), true);
    });
    const s = stock[this.sel];
    if (s) {
      if (s.kind === 'item') drawItemCard(ctx, s.item, 330, 62, 250, false);
      else { box(ctx, 330, 62, 250, 70); drawText(ctx, s.name, 342, 72, { size: 12, color: '#ffffff' }); drawText(ctx, s.desc, 342, 94, { size: 10, color: '#dfe3ee', maxWidth: 226 }); }
    }
    drawText(ctx, hint('↑/↓ 选择　确认键 购买　翻滚键 离开', '点一下查看，再点一次购买　·　右上角「返回」离开'), W / 2, H - 22, { size: 10, color: '#9aa0b4', align: 'center', outline: INK });
  }
}

// ---------------------------------------------------------------- 终端机（永久解锁）
class TerminalScreen extends Screen {
  constructor(ui) {
    super(ui);
    const run = G.run, save = G.save;
    this.banked = run.data;
    save.data += run.data; run.data = 0;
    // 永久余额与存档点携带的数据在同一次写入中改变，失败后也不会只保存一半。
    if (!this.game.patchCheckpoint((r) => { r.data = 0; })) this.game.toast('数据仅在当前页面有效：存档写入失败', '#ff6b5e');
    if (this.banked > 0) audio.sfx('data');
    this.scroll = 0;
  }
  list() { return META.filter((m) => metaAvailable(G.save, m)); }
  update(dt) {
    super.update(dt);
    const list = this.list();
    this.nav(list.length);
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + 7) this.scroll = this.sel - 6;
    if (input.menuCancel()) { this.back(); return; }
    if (input.menuConfirm() && this.t > 0.15) this.buy(this.sel);
  }
  get canBack() { return true; }
  buy(i) {
    const save = G.save, m = this.list()[i];
    if (!m || save.unlocks[m.id]) { audio.sfx('deny'); return; }
    if (save.data < m.cost) { audio.sfx('deny'); this.game.hud.toast('数据不足', '#ff6b5e'); return; }
    save.data -= m.cost; save.unlocks[m.id] = true;
    const saved = writeSave();
    audio.sfx('perk');
    G.run.recalc();
    this.game.hud.toast(saved ? '已解锁：' + m.name : '解锁仅在当前页面有效：存档写入失败', saved ? COLORS.data : '#ff6b5e');
  }
  draw(ctx) {
    dim(ctx, 0.75);
    const save = G.save, list = this.list();
    drawText(ctx, '终端机 · 成果转化', W / 2, 14, { size: 12, color: COLORS.data, align: 'center', outline: INK });
    drawText(ctx, (this.banked > 0 ? `已上传 {c}${this.banked}{/} 点数据。` : '') + `数据库存 {c}${save.data}{/}　（解锁内容永久保留）`, W / 2, 32, { size: 10, color: '#c8ccd6', align: 'center', outline: INK });
    const x = 40, wd = 300;
    for (let r = 0; r < 7; r++) {
      const i = this.scroll + r, m = list[i];
      if (!m) break;
      const y = 52 + r * 37, sel = i === this.sel, owned = !!save.unlocks[m.id];
      box(ctx, x, y, wd, 32, sel);
      const icon = m.item ? ITEMS[m.item].icon : m.icon;
      drawIcon(ctx, icon, x + 17, y + 26, '#8a90a8');
      drawText(ctx, m.name, x + 36, y + 4, { size: 12, color: owned ? '#7be07b' : '#ffffff' });
      drawText(ctx, owned ? '已解锁' : `${m.cost} 数据`, x + 36, y + 19, { size: 10, color: owned ? '#7be07b' : save.data >= m.cost ? COLORS.data : '#ff6b5e' });
      this.hot(x, y, wd, 32, i, () => this.buy(i), true);
    }
    // 翻页箭头（可点）
    if (this.scroll > 0) { drawText(ctx, '▲', x + wd + 8, 54, { size: 10, color: '#9aa0b4' }); this.hot(x + wd + 2, 46, 22, 26, this.sel, () => { this.sel = Math.max(0, this.scroll - 1); audio.sfx('move'); }); }
    if (this.scroll + 7 < list.length) { drawText(ctx, '▼', x + wd + 8, 52 + 6 * 37 + 16, { size: 10, color: '#9aa0b4' }); this.hot(x + wd + 2, 52 + 6 * 37 + 8, 22, 26, this.sel, () => { this.sel = Math.min(list.length - 1, this.scroll + 7); audio.sfx('move'); }); }
    const m = list[this.sel];
    if (m) {
      box(ctx, 366, 52, 240, 150);
      drawText(ctx, m.name, 378, 62, { size: 12, color: '#ffe9a0' });
      let cy = 84;
      cy += drawText(ctx, m.desc, 378, cy, { size: 10, color: '#dfe3ee', maxWidth: 216 }) + 6;
      if (m.item) drawText(ctx, ITEMS[m.item].desc, 378, cy, { size: 10, color: '#b8bccc', maxWidth: 216 });
    }
    drawText(ctx, hint('↑/↓ 选择　确认键 解锁　翻滚键 离开', '点一下查看，再点一次解锁　·　右上角「返回」离开'), W / 2, H - 20, { size: 10, color: '#9aa0b4', align: 'center', outline: INK });
  }
}

// ---------------------------------------------------------------- 列表菜单（暂停 / 设置）
class MenuScreen extends Screen {
  constructor(ui, title, items, o = {}) { super(ui); this.title = title; this.items = items; this.o = o; }
  update(dt) {
    super.update(dt);
    this.nav(this.items.length);
    // 光标挪开后，「再按一次确认」类的项目要重新确认
    if (this.sel !== this.lastSel) { this.lastSel = this.sel; if (this.o.onMove) this.o.onMove(); }
    const it = this.items[this.sel];
    if (it && it.adjust) {
      if (input.pressed('left')) { it.adjust(-1); audio.sfx('move'); }
      if (input.pressed('right')) { it.adjust(1); audio.sfx('move'); }
    }
    if (input.menuCancel() && this.t > 0.15) { this.back(); return; }
    if (input.menuConfirm() && this.t > 0.15 && it) { audio.sfx('select'); if (it.action) it.action(); else if (it.adjust) it.adjust(1); }
  }
  get canBack() { return true; }
  back() { audio.sfx('back'); if (this.o.onClose) this.o.onClose(); this.close(); }
  draw(ctx) {
    dim(ctx, this.o.dim === undefined ? 0.7 : this.o.dim);
    drawText(ctx, this.title, W / 2, 30, { size: 12, color: '#ffe9a0', align: 'center', outline: INK });
    const bw = 240, x = this.o.side ? 40 : (W - bw) / 2;
    this.items.forEach((it, i) => {
      const y = 58 + i * 28, sel = i === this.sel;
      box(ctx, x, y, bw, 22, sel);
      const label = typeof it.label === 'function' ? it.label() : it.label;
      drawText(ctx, label, x + 10, y + 5, { size: 12, color: it.danger ? (sel ? '#ff8a80' : '#d9837c') : sel ? '#ffd24a' : '#ffffff' });
      if (it.value) drawText(ctx, it.value(), x + bw - 10, y + 5, { size: 12, color: '#62e6ff', align: 'right' });
      // 点击调整类的项目：到头后绕回去（触屏没有「左 / 右」）
      this.hot(x, y, bw, 22, i, () => { audio.sfx('select'); if (it.action) it.action(); else if (it.adjust) it.adjust(1, true); });
    });
    if (this.o.extra) this.o.extra(ctx, x + bw + 20);
    drawText(ctx, hint(this.o.hint || '↑/↓ 选择　←/→ 调整　确认键 决定　翻滚键 返回', this.o.hintTouch || '点选项目　·　右上角「返回」'), W / 2, H - 20, { size: 10, color: '#9aa0b4', align: 'center', outline: INK });
  }
}

// 破坏性操作使用独立确认页，默认选中取消；范围和后果在按键前完整展示。
class ConfirmScreen extends Screen {
  constructor(ui, title, text, label, action) {
    super(ui); this.title = title; this.text = text;
    this.items = [
      { label: '取消', action: () => this.back() },
      { label, danger: true, action: () => { this.close(); action(); } },
    ];
  }
  get canBack() { return true; }
  update(dt) {
    super.update(dt);
    if (!this.nav(2)) this.nav(2, true);
    if (input.menuCancel()) this.back();
    else if (input.menuConfirm() && this.t > 0.2) this.items[this.sel].action();
  }
  draw(ctx) {
    dim(ctx, 0.86);
    panel(ctx, 76, 58, 488, 242);
    drawText(ctx, this.title, W / 2, 76, { size: 12, color: '#ffe9a0', align: 'center' });
    drawText(ctx, this.text, 100, 108, { size: 12, color: '#dfe3ee', maxWidth: 440, lineGap: 7 });
    this.items.forEach((it, i) => {
      const x = 128 + i * 200;
      box(ctx, x, 252, 184, 26, this.sel === i);
      drawText(ctx, it.label, x + 92, 259, { size: 12, color: it.danger ? '#ff8a80' : '#ffffff', align: 'center' });
      this.hot(x, 252, 184, 26, i, it.action);
    });
    drawText(ctx, hint('方向键选择　确认键决定　翻滚键取消', '点选按钮　·　右上角「返回」取消'), W / 2, 286, { size: 8, color: '#9aa0b4', align: 'center' });
  }
}

// ---------------------------------------------------------------- 文本页（操作说明 / 开场）
class TextScreen extends Screen {
  constructor(ui, title, text, o = {}) { super(ui); this.title = title; this.text = text; this.o = o; this.chars = o.typed ? 0 : 1e6; }
  update(dt) {
    super.update(dt);
    if (this.o.typed) this.chars += dt * 26;
    const done = this.chars >= this.text.length;
    if ((input.menuConfirm() || input.menuCancel()) && this.t > 0.2) {
      if (!done) { this.chars = 1e6; return; }
      audio.sfx('select'); this.close(); if (this.o.onClose) this.o.onClose();
    }
  }
  draw(ctx) {
    if (this.o.solid) solid('#0a0812'); else dim(ctx, 0.8);
    if (this.title) drawText(ctx, this.title, W / 2, 22, { size: 12, color: '#ffe9a0', align: 'center', outline: INK });
    const shown = this.o.typed ? this.text.slice(0, Math.floor(this.chars)) : this.text;
    drawText(ctx, shown, this.o.x || 70, this.o.y || 50, { size: 12, color: '#e8ecf4', maxWidth: this.o.w || 500, lineGap: this.o.gap === undefined ? 6 : this.o.gap });
    if (this.chars >= this.text.length && Math.floor(this.t * 2) % 2) drawText(ctx, hint('▼ 按确认键继续', '▼ 点击屏幕继续'), W / 2, H - 24, { size: 10, color: '#9aa0b4', align: 'center' });
    this.hot(-200, 0, W + 400, H, 0, () => { if (this.chars < this.text.length) this.chars = 1e6; else { this.close(); if (this.o.onClose) this.o.onClose(); } });
  }
}

// ---------------------------------------------------------------- 结算
class ResultScreen extends Screen {
  constructor(ui, win, stats) {
    super(ui); this.win = win; this.stats = stats;
    this.items = [['再来一局', () => this.game.startRun()], ['回到标题', () => this.game.toTitle()]];
  }
  update(dt) {
    super.update(dt);
    if (this.t < 0.8) return;
    this.nav(this.items.length, true);
    if (input.menuConfirm()) { audio.sfx('select'); this.items[this.sel][1](); }
  }
  draw(ctx) {
    dim(ctx, Math.min(0.82, this.t * 1.2));
    const s = this.stats, a = clamp(this.t * 2, 0, 1);
    drawTextBig(ctx, this.win ? '实验成功' : '观测结果：死亡', W / 2, 34, 2, { color: this.win ? '#7be07b' : '#ff6b5e', outline: INK, align: 'center', alpha: a });
    drawText(ctx, this.win ? '奇点被关闭，实验楼恢复了平静。张震拧开保温杯，喝了一口凉透的枸杞茶。' : '波函数重新坍缩——实验室将换一副模样等你回来。', W / 2, 74, { size: 10, color: '#c8ccd6', align: 'center', alpha: a, maxWidth: 520 });
    const rows = [
      ['到达区域', s.stageName], ['击杀怪物', String(s.kills)], ['用时', fmtTime(s.time)],
      ['领悟定理', String(s.perks)], ['上传数据', `${s.banked}`],
      [this.win ? '熵等级' : '未上传的数据', this.win ? `${s.entropy}（下一局怪物更强）` : (s.lost + s.kept > 0 ? `保住 ${s.kept}，丢失 ${s.lost}` : '无')],
    ];
    rows.forEach(([k, v], i) => {
      const y = 104 + i * 22;
      drawText(ctx, k, W / 2 - 110, y, { size: 12, color: '#9aa0b4', alpha: a });
      drawText(ctx, v, W / 2 + 110, y, { size: 12, color: '#ffffff', align: 'right', alpha: a });
      ctx.globalAlpha = 0.3 * a; ctx.fillStyle = '#6a7088'; ctx.fillRect(W / 2 - 110, y + 16, 220, 1); ctx.globalAlpha = 1;
    });
    if (this.t > 0.8) {
      const bw = 130, gap = 20, total = bw * 2 + gap;
      this.items.forEach(([label, fn], i) => {
        const x = (W - total) / 2 + i * (bw + gap), y = H - 64;
        box(ctx, x, y, bw, 24, i === this.sel);
        drawText(ctx, label, x + bw / 2, y + 6, { size: 12, color: i === this.sel ? '#ffd24a' : '#ffffff', align: 'center' });
        this.hot(x, y, bw, 24, i, () => { audio.sfx('select'); fn(); });
      });
    }
  }
}

// ---------------------------------------------------------------- 图鉴
class BestiaryScreen extends Screen {
  constructor(ui) { super(ui); this.ids = Object.keys(BESTIARY); this.cols = 6; }
  update(dt) {
    super.update(dt);
    const n = this.ids.length, prev = this.sel;
    if (input.pressed('left')) this.sel = (this.sel + n - 1) % n;
    if (input.pressed('right')) this.sel = (this.sel + 1) % n;
    if (input.pressed('up')) this.sel = (this.sel - this.cols + n) % n;
    if (input.pressed('down')) this.sel = (this.sel + this.cols) % n;
    if (prev !== this.sel) audio.sfx('move');
    if ((input.menuCancel() || input.pressed('confirm')) && this.t > 0.2) this.back();
  }
  get canBack() { return true; }
  draw(ctx) {
    solid('#0e0c18');
    const save = G.save;
    const seenN = this.ids.filter((id) => save.seen[id]).length;
    drawText(ctx, `怪物图鉴　{d}${seenN}/${this.ids.length}{/}`, 20, 12, { size: 12, color: '#ffe9a0', outline: INK });
    const cs = 50, gx = 20, gy = 36;
    this.ids.forEach((id, i) => {
      const def = BESTIARY[id].def;
      const x = gx + (i % this.cols) * (cs + 6), y = gy + Math.floor(i / this.cols) * (cs + 6);
      const sel = i === this.sel, seen = !!save.seen[id];
      box(ctx, x, y, cs, cs, sel, def.boss ? '#c94ad8' : '#3a3850');
      const spr = def.icon || def.spr + '/0';
      const sx = x + cs / 2, sy = y + cs - 5;
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 1, y + 1, cs - 2, cs - 2); ctx.clip();
      const sc = def.iconScale || 1;
      if (hasSprite(spr) || hasSprite(def.spr + '/idle/0')) {
        const name = hasSprite(spr) ? spr : def.spr + '/idle/0';
        if (seen) { if (sc !== 1) drawSpriteScaled(ctx, name, sx, sy + (def.iconOy || 0), sc); else drawSprite(ctx, name, sx, sy + (def.iconOy || 0)); } else if (sc !== 1) drawSpriteScaled(ctx, name, sx, sy + (def.iconOy || 0), sc, false, 1, '#2c2a40'); else drawSil(ctx, name, sx, sy + (def.iconOy || 0), false, '#2c2a40');
      }
      ctx.restore();
      if (!seen) drawText(ctx, '?', sx, y + 18, { size: 12, color: '#6a7088', align: 'center' });
      this.hot(x, y, cs, cs, i, () => {});
    });
    // 详情
    const id = this.ids[this.sel], def = BESTIARY[id].def, seen = !!save.seen[id];
    const px = 372, pw = 250;
    box(ctx, px, 36, pw, 286);
    drawText(ctx, seen ? def.name : '？？？', px + 12, 46, { size: 12, color: def.boss ? '#e8a0f0' : '#ffe9a0' });
    if (seen) {
      drawText(ctx, `已击败 ${save.seen[id]} 次`, px + pw - 12, 48, { size: 10, color: '#9aa0b4', align: 'right' });
      let cy = 70;
      cy += drawText(ctx, def.desc || '', px + 12, cy, { size: 10, color: '#dfe3ee', maxWidth: pw - 24, lineGap: 4 }) + 10;
      if (def.tip) drawText(ctx, '{y}应对：{/}' + def.tip, px + 12, cy, { size: 10, color: '#c8ccd6', maxWidth: pw - 24, lineGap: 4 });
    } else drawText(ctx, '还没有遇到过。继续深入实验楼吧。', px + 12, 70, { size: 10, color: '#6a7088', maxWidth: pw - 24 });
    drawText(ctx, hint('方向键 选择　翻滚键 返回', '点选怪物查看　·　右上角「返回」'), W / 2, H - 16, { size: 10, color: '#9aa0b4', align: 'center', outline: INK });
  }
}

// ---------------------------------------------------------------- 标题
class TitleScreen extends Screen {
  constructor(ui) {
    super(ui);
    this.pausesWorld = false;
    this.hasSave = null;
    this.build();
  }
  /** 菜单项随「有没有存档点」变化：有存档时第一项是「继续」 */
  build() {
    const s = this.game.runSave;
    const has = !!s;
    if (has === this.hasSave) return;
    this.hasSave = has;
    this.items = [];
    if (has) {
      this.items.push([() => { const c = this.game.runSave; return c ? `继续 · ${c.name}` : '继续'; }, () => this.game.continueRun()]);
      this.items.push(['新的实验', () => this.ui.confirm('开始新的实验？', '当前这一局和区域存档点将被替换。\n永久解锁、数据库存、图鉴、统计和设置都会保留。', '放弃本局并开始', () => this.game.beginFromTitle())]);
    } else this.items.push(['开始实验', () => this.game.beginFromTitle()]);
    this.items.push(
      ['怪物图鉴', () => this.ui.push(new BestiaryScreen(this.ui))],
      ['设置', () => this.ui.openSettings()],
      ['操作说明', () => this.ui.openHelp()],
    );
    // 手机浏览器：给一个显眼的全屏入口（同时会请求锁定横屏）
    if (VIEW.touch && this.game.canFullscreen) this.items.push([() => (document.fullscreenElement ? '退出全屏' : '全屏游玩'), () => this.game.toggleFullscreen()]);
    this.sel = 0;
  }
  update(dt) {
    super.update(dt);
    this.build();
    this.nav(this.items.length);
    if (input.menuConfirm() && this.t > 0.3) { audio.sfx('select'); this.items[this.sel][1](); }
  }
  /** 背景画在主画面上，铺满整个宽度（ox = 640 设计区的左边缘） */
  drawBack(ctx, vw, ox) {
    const t = this.t;
    // 实验楼走廊
    ctx.fillStyle = '#12101e'; ctx.fillRect(0, 0, vw, H);
    for (let i = -3; i < 18; i++) { ctx.fillStyle = i & 1 ? '#191628' : '#161424'; ctx.fillRect(ox + i * 48 - 10, 60, 46, 200); }
    ctx.fillStyle = '#23203a'; ctx.fillRect(0, 258, vw, 4);
    ctx.fillStyle = '#1b1830'; ctx.fillRect(0, 262, vw, H - 262);
    // 窗与月光
    for (const w0 of [70, 520]) {
      const wx = ox + w0;
      ctx.fillStyle = INK; ctx.fillRect(wx - 2, 88, 64, 84);
      ctx.fillStyle = '#243058'; ctx.fillRect(wx, 90, 60, 80);
      ctx.fillStyle = '#3a4a80'; ctx.fillRect(wx, 90, 60, 30);
      ctx.fillStyle = INK; ctx.fillRect(wx + 29, 90, 2, 80); ctx.fillRect(wx, 128, 60, 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(wx + 12 + ((w0 * 7) % 20), 100, 1, 1); ctx.fillRect(wx + 44, 112, 1, 1);
    }
    ctx.fillStyle = '#e8ecff'; ctx.fillRect(ox + 538, 98, 10, 10); ctx.fillStyle = '#243058'; ctx.fillRect(ox + 542, 96, 8, 8);
    // 闪烁的应急灯
    const flick = Math.sin(t * 7) > -0.85 ? 1 : 0.4;
    ctx.globalAlpha = 0.12 * flick; ctx.fillStyle = '#62e6ff';
    for (let r = 0; r < 5; r++) ctx.fillRect(ox + 320 - 90 - r * 22, 60, 180 + r * 44, 200);
    ctx.globalAlpha = 1;
  }
  draw(ctx) {
    const t = this.t, save = G.save;
    // 角色
    if (hasSprite('herox/idle/0')) drawSprite(ctx, 'herox/idle/' + (Math.floor(t * 5) % 6), 150, 262);
    if (hasSprite('dulix/idle/0')) { drawSil(ctx, 'dulix/idle/' + (Math.floor(t * 5) % 6), 512, 262, true, '#0c0a14'); if (save.seen.duli) drawSprite(ctx, 'dulix/idle/' + (Math.floor(t * 5) % 6), 512, 262, true, 0.9); }
    // 标题
    const bob = Math.round(Math.sin(t * 1.6) * 2);
    drawTextBig(ctx, '坍缩实验室', W / 2, 30 + bob, 4, { color: '#e8f4ff', outline: INK, align: 'center' });
    ctx.fillStyle = '#62e6ff'; ctx.fillRect(W / 2 - 120, 96 + bob, 240, 1);
    drawText(ctx, '张震的不可逆之夜', W / 2, 102 + bob, { size: 12, color: '#62e6ff', align: 'center', outline: INK });
    // 菜单
    this.build();
    const bw = 200, x = (W - bw) / 2, n = this.items.length;
    const gap = n > 5 ? 24 : n > 4 ? 26 : 28, y0 = n > 5 ? 136 : n > 4 ? 144 : 150, bh = n > 5 ? 20 : 22;
    this.items.forEach(([label, fn], i) => {
      const y = y0 + i * gap, sel = i === this.sel;
      box(ctx, x, y, bw, bh, sel, i === 0 && this.hasSave ? '#7be07b' : '#3a3850');
      drawText(ctx, typeof label === 'function' ? label() : label, W / 2, y + (bh >> 1) - 6, { size: 12, color: sel ? '#ffd24a' : '#ffffff', align: 'center' });
      this.hot(x, y, bw, bh, i, () => { audio.sfx('select'); fn(); });
    });
    const k = (a) => this.game.keyLabel(a);
    drawText(ctx, isTouch() ? '点选菜单开始　·　游戏中左手拖动摇杆，右手按圆键' : `${k('up')}/${k('down')} 选择　${k('confirm')} 确认　·　${k('left')}/${k('right')} 移动　${k('jump')} 跳　${k('atk1')} 攻击　${k('roll')} 翻滚`, W / 2, H - 72, { size: 10, color: '#c8ccd6', align: 'center', outline: INK });
    drawText(ctx, `实验次数 ${save.runs}　通关 ${save.wins}　熵等级 ${save.entropy}　数据库存 {c}${save.data}{/}`, W / 2, H - 56, { size: 10, color: '#9aa0b4', align: 'center', outline: INK });
    if (this.hasSave) drawText(ctx, '继续将从区域入口重新开始，区域内进度不保留', W / 2, H - 24, { size: 10, color: '#c8ccd6', align: 'center', outline: INK });
    if (!saveStatus().ok) drawText(ctx, '存档写入失败：本次更改仅在当前页面有效', W / 2, H - 10, { size: 8, color: '#ff8a80', align: 'center', outline: INK });
    // 竖着拿手机时画面已被旋转成横屏：提醒把手机横过来
    if (VIEW.rot && Math.floor(t * 1.5) % 4 !== 3) drawText(ctx, '本游戏为横屏游玩　·　请把手机横过来握持', W / 2, H - 40, { size: 10, color: '#62e6ff', align: 'center', outline: INK });
  }
}

// ---------------------------------------------------------------- 管理器
export class UI {
  constructor(game) {
    this.game = game; this.stack = []; this.regions = [];
    // 离屏画布：界面内容先画在这里（透明底），再居中贴到主画面
    this.cv = document.createElement('canvas');
    this.cv.width = W; this.cv.height = H;
    this.g = this.cv.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.armed = null; this.armedScreen = null;
  }
  get active() { return this.stack[this.stack.length - 1] || null; }
  confirm(title, text, label, action) { return this.push(new ConfirmScreen(this, title, text, label, action)); }
  get blocking() { const a = this.active; return !!(a && a.pausesWorld); }
  // 界面弹出时松开所有虚拟按键（手指还按着的摇杆 / 攻击不会带进菜单）
  push(s) { this.stack.push(s); input.consumeMenu(); touch.reset(); this.armed = null; return s; }
  remove(s) { const i = this.stack.indexOf(s); if (i >= 0) this.stack.splice(i, 1); input.consumeMenu(); this.armed = null; }
  clear() { this.stack.length = 0; this.armed = null; }
  update(dt) { const a = this.active; if (a) a.update(dt); }

  draw(ctx) {
    this.regions.length = 0;
    const a = this.active;
    if (!a) return;
    const g = this.g, ox = (VW - W) >> 1;
    // 只画最上层（下层若是标题则保留作背景）
    for (const s of this.stack) {
      if (s !== a && !(s instanceof TitleScreen)) continue;
      this.regions.length = 0;
      BACK.length = 0;
      g.clearRect(0, 0, W, H);
      s.draw(g);
      if (s === a && s.canBack && isTouch()) this.drawBackButton(g, s);
      if (s.drawBack) s.drawBack(ctx, VW, ox);
      for (const [color, alpha] of BACK) { ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(0, 0, VW, H); }
      ctx.globalAlpha = 1;
      ctx.drawImage(this.cv, ox, 0);
    }
  }

  /** 触屏的「返回」键（相当于键盘的翻滚键 / Esc） */
  drawBackButton(g, s) {
    const w = 62, h = 22, x = W - w - 8, y = 6;
    box(g, x, y, w, h, false, '#8a90a8');
    drawText(g, '← 返回', x + w / 2, y + 5, { size: 12, color: '#e8ecf4', align: 'center' });
    this.regions.push({ x: x - 10, y: 0, w: w + 18, h: h + 16, screen: s, index: s.sel, onClick: () => s.back(), twoStep: false });
  }

  /** 画布上的指针事件（640 宽设计区内的坐标） */
  /** 这个位置上最上层的点击区域（本帧登记顺序的下标），没有则 -1 */
  hit(x, y) {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  }

  pointer(x, y, click) {
    const a = this.active;
    if (!a) return false;
    if (click && a.t < 0.18) return true;        // 界面刚弹出来：不吃连点带来的误触
    const i = this.hit(x, y);
    if (i < 0) return false;
    const r = this.regions[i];
    if (r.screen === a) {
      if (a.sel !== r.index) { a.sel = r.index; if (!click) audio.sfx('move'); }
      if (click) {
        if (r.twoStep && isTouch() && (this.armed !== r.index || this.armedScreen !== a)) { this.armed = r.index; this.armedScreen = a; audio.sfx('move'); } else r.onClick();
      }
    }
    return true;
  }

  openTitle() { this.clear(); this.push(new TitleScreen(this)); }
  openPickup(pickup) {
    const run = G.run, item = pickup.item, def = ITEMS[item.id];
    // 有空位且不花钱：直接装上
    if (!pickup.price) {
      const w = G.world, p = w.player;
      let done = false;
      if (def.kind === 'skill' && !run.skill) { run.skill = item; done = true; } else if (def.kind === 'weapon' && !run.weapons[1]) { run.weapons[1] = item; done = true; }
      if (done) {
        pickup.taken(); audio.sfx('equip');
        w.fx.ring(p.x, p.cy, itemColor(item), 4, 30, 0.3);
        this.game.hud.toast('装备了 ' + itemTitle(item), itemColor(item));
        return;
      }
    }
    this.push(new PickupScreen(this, pickup));
  }
  openScroll(pickup) {
    const cards = ['force', 'tech', 'vital'].map((k) => ({ id: k, name: SCROLLS[k].name, desc: SCROLLS[k].desc, color: SCROLLS[k].color, icon: SCROLLS[k].icon }));
    audio.sfx('scroll');
    this.push(new ChoiceScreen(this, '研读文献', '选择一个方向提升自己', cards, (c) => {
      G.run.addScroll(c.id); pickup.dead = true; audio.sfx('perk');
      const p = G.world.player;
      G.world.fx.ring(p.x, p.cy, c.color, 6, 44, 0.4, 2);
      this.game.hud.toast(c.name + ' 已掌握', c.color);
    }));
  }
  openPerks(board) {
    if (!board.choices) board.choices = G.run.rollPerks(3);
    const cards = board.choices.map((id) => ({ id, name: PERKS[id].name, desc: PERKS[id].desc, icon: PERKS[id].icon, color: '#ffe9a0' }));
    if (!cards.length) { this.game.hud.toast('已经没有新的定理了', '#9aa0b4'); return; }
    this.push(new ChoiceScreen(this, '黑板上的定理', '领悟一条，本局生效', cards, (c) => {
      G.run.addPerk(c.id); board.used = true; audio.sfx('perk');
      const p = G.world.player;
      G.world.fx.ring(p.x, p.cy, '#ffe9a0', 6, 50, 0.4, 2);
      this.game.hud.toast('领悟：' + c.name, '#ffe9a0');
    }));
  }
  openShop(v) { this.push(new ShopScreen(this, v)); }
  openTerminal() { this.push(new TerminalScreen(this)); }
  openResult(win, stats) { this.push(new ResultScreen(this, win, stats)); }
  openBestiary() { this.push(new BestiaryScreen(this)); }
  openIntro(onClose) {
    this.push(new TextScreen(this, '', '凌晨两点，物理实验楼。\n\n研究生张震独自守着对撞实验，顺手把保温杯搁在了控制台上。\n\n警报响起时已经晚了——整栋楼的现实像没人观测的波函数一样散开，摆锤、线圈、烧瓶都活了过来，连隔壁组的嘟礼也变了模样。\n\n每一次倒下，实验室都会重新坍缩成另一副样子。\n穿过四个实验区，关掉对撞核心里的那个奇点。', { typed: true, solid: true, y: 70, onClose }));
  }
  openHelp() {
    const k = (a) => this.game.keyLabel(a);
    if (isTouch()) {
      const tt = '{y}移动{/}　' + (touch.fixed ? '左下角的摇杆，按住往左右推（位置固定；可在设置里改成跟随手指）' : '左手在屏幕左半边任意位置按住拖动（摇杆会出现在手指下）') + '\n{y}攻击{/}　右下角三个带图标的圆键：{r}红{/} 主手　{y}黄{/} 副手　{p}紫{/} 技能\n{y}跳{/}　空中可再跳一次　　{y}滚{/}　翻滚 / 空中冲刺（期间无敌）\n{y}下跳{/}　摇杆向下 + 跳（站在平台上）　{y}下砸{/}　空中 摇杆向下 + 跳\n{y}保温杯{/}　白色小圆键回血　　{y}互动{/}　靠近设施时出现在右侧\n{y}暂停{/}　小地图左边的 Ⅱ　　{y}地图{/}　点右上角的小地图\n\n· 朝着墙沿跳跃可以自动攀上去。\n· 近战挥击能把敌人的子弹{c}弹反{/}回去。\n· 怪物出招前会闪红并冒出「!」，这时翻滚最安全。\n· {c}数据{/}要带到茶水间的终端机上传才算数，死亡时未上传的部分只能保住三成。\n· 进度自动保存在本机浏览器：每进入一个区域存一次档，标题画面选「继续」接着玩。\n· 本游戏为横屏游玩；也支持键盘与手柄。';
      this.push(new TextScreen(this, '操作说明', tt, { x: 56, y: 40, w: 530, gap: 5 }));
      return;
    }
    const text = `{y}移动{/}　${k('left')} / ${k('right')}　　{y}跳跃{/}　${k('jump')}（空中可再跳一次）\n{y}主手攻击{/}　${k('atk1')}　　{y}副手{/}　${k('atk2')}　　{y}技能{/}　${k('skill')}\n{y}翻滚 / 空中冲刺{/}　${k('roll')}（期间无敌，可穿过敌人和矮通道）\n{y}喝保温杯{/}　${k('heal')}　　{y}互动{/}　${k('interact')}　　{y}暂停{/}　${k('pause')}\n{y}下跳{/}　${k('down')} + ${k('jump')}（站在平台上）　{y}下砸{/}　空中 ${k('down')} + ${k('jump')}\n\n· 朝着墙沿跳跃可以自动攀上去。\n· 近战挥击能把敌人的子弹{c}弹反{/}回去。\n· 怪物出招前会闪红并冒出「!」，这时翻滚最安全。\n· {c}数据{/}要带到茶水间的终端机上传才算数，死亡时未上传的部分只能保住三成。\n· 按住 ${k('map')} 查看整张地图。键盘也可用 方向键 + Z / X / C / Shift；支持手柄与触屏。\n· 进度自动保存在本机浏览器：每进入一个区域存一次档，标题画面选「继续」接着玩。`;
    this.push(new TextScreen(this, '操作说明', text, { x: 56, y: 40, w: 530, gap: 5 }));
  }
  openSettings() {
    const st = G.save.settings;
    const apply = () => { audio.setVolumes(st.sfx, st.music); if (!writeSave()) this.game.toast('设置未能写入浏览器，仅在当前页面有效', '#ff6b5e'); };
    const pct = (v) => Math.round(v * 100) + '%';
    const vol = (v, d, wrap) => { const n = Math.round((v + d * 0.1) * 10) / 10; return wrap && n > 1 ? 0 : clamp(n, 0, 1); };
    const items = [
      // wrap：点击调整时到 100% 后回到 0
      { label: '音效音量', value: () => pct(st.sfx), adjust: (d, wrap) => { st.sfx = vol(st.sfx, d, wrap); apply(); audio.sfx('select'); } },
      { label: '音乐音量', value: () => pct(st.music), adjust: (d, wrap) => { st.music = vol(st.music, d, wrap); apply(); } },
      { label: '画面震动', value: () => (st.shake ? '开' : '关'), adjust: () => { st.shake = !st.shake; apply(); } },
      { label: '受伤闪屏', value: () => (st.flash ? '开' : '关'), adjust: () => { st.flash = !st.flash; apply(); } },
      { label: '全屏', value: () => (document.fullscreenElement ? '开' : '关'), action: () => this.game.toggleFullscreen() },
      // 触屏摇杆：固定在左下角（默认），或者按在哪里就出现在哪里
      ...(VIEW.touch || isTouch() ? [{ label: '摇杆位置', value: () => (st.stickFixed !== false ? '固定' : '跟随手指'), adjust: () => { st.stickFixed = st.stickFixed === false; touch.fixed = st.stickFixed; touch.reset(); apply(); } }] : []),
      { label: '存档管理', value: () => saveStatus().text, action: () => this.openSaveManager() },
      { label: '恢复默认设置', action: () => this.confirm('恢复默认设置？', '音量、画面效果和触屏偏好将恢复默认值。\n永久进度和本局区域存档点都会保留。', '恢复设置', () => this.game.restoreSettings()) },
    ];
    this.push(new MenuScreen(this, '设置', items, { hintTouch: '点一下切换 / 调整（音量到 100% 后回到 0）　·　右上角「返回」' }));
  }
  openSaveManager() {
    const description = '存档只属于本机浏览器的当前站点，不会跨设备同步。\n\n永久解锁、图鉴、统计和设置在变化时保存。\n本局只在进入区域时保存；继续会回到区域入口，区域内的位置、战斗与收获不会保留。\n\n更换浏览器、域名或端口会使用另一份存档；同一站点的不同路径共享存档。';
    this.push(new MenuScreen(this, '存档管理', [
      { label: '查看存档规则', action: () => this.push(new TextScreen(this, '存档规则', description, { x: 70, y: 60, w: 500 })) },
      { label: '重试写入存档', action: () => this.game.toast(writeSave() ? '本游戏存档已写入' : '写入失败：本次更改仅在当前页面有效', saveStatus().ok ? '#9dffb0' : '#ff6b5e') },
      { label: '重置本游戏进度', danger: true, action: () => this.confirm('重置坍缩实验室进度？', '将删除本机浏览器当前站点中，坍缩实验室的永久解锁、数据库存、图鉴、统计和本局存档点，并回到标题。\n\n游戏设置和其他游戏的存档会保留。此操作无法撤销。', '重置本游戏进度', () => this.game.wipeSaves()) },
    ], { hint: '↑/↓ 选择　确认键 决定　翻滚键 返回', hintTouch: '点选项目　·　右上角「返回」' }));
  }
  openPause() {
    const run = G.run;
    const items = [
      { label: '继续', action: () => { this.remove(pause); audio.duck(false); } },
      { label: '回到标题', action: () => this.confirm('回到标题？', `继续时会从「${this.game.runSave?.name || '当前区域'}」入口重新开始。\n本区域内的位置、战斗和新收获不会保存；永久解锁与设置会保留。${saveStatus().ok ? '' : '\n\n存档写入失败：关掉页面可能丢失本次更改。'}`, '回到标题', () => { audio.duck(false); this.game.returnToTitle(); }) },
      { label: '操作说明', action: () => this.openHelp() },
      { label: '设置', action: () => this.openSettings() },
      { label: '怪物图鉴', action: () => this.openBestiary() },
      { label: '放弃本局', danger: true, action: () => this.confirm('放弃本局？', '将删除本局区域存档点，本局未上传的数据也会丢失。\n永久解锁、数据库存、图鉴、统计和设置会保留。', '放弃本局', () => { audio.duck(false); this.game.abandonRun(); }) },
    ];
    const extra = (ctx, x) => {
      const st = STAGES[run.stage];
      drawText(ctx, `{d}当前{/} ${st.name || '茶水间'}　{d}用时{/} ${fmtTime(run.time)}　{d}击杀{/} ${run.kills}`, x, 60, { size: 10, color: '#ffffff' });
      drawText(ctx, `文献　{r}力学 ${run.scrolls.force}{/}　{p}电磁 ${run.scrolls.tech}{/}　{g}热学 ${run.scrolls.vital}{/}`, x, 78, { size: 10, color: '#c8ccd6' });
      const cp = this.game.runSave;
      drawText(ctx, saveStatus().ok ? `{g}存档点{/}　${cp ? cp.name : st.name || '茶水间'}入口（每进入一个区域自动保存）` : '{r}这个浏览器无法写入本地存档，进度只在本次有效{/}', x, 96, { size: 10, color: '#c8ccd6' });
      drawText(ctx, '区域内进度不保留；继续时从入口重新开始', x, 112, { size: 10, color: '#c8ccd6', maxWidth: W - x - 16 });
      drawText(ctx, '已领悟的定理', x, 142, { size: 10, color: '#ffe9a0' });
      let cy = 158;
      if (!run.perks.length) drawText(ctx, '（还没有——去茶水间的黑板看看）', x, cy, { size: 10, color: '#6a7088' });
      for (const id of run.perks) {
        cy += drawText(ctx, `{y}${PERKS[id].name}{/}　${PERKS[id].desc}`, x, cy, { size: 10, color: '#c8ccd6', maxWidth: W - x - 16, lineGap: 3 }) + 5;
        if (cy > H - 40) break;
      }
    };
    const pause = new MenuScreen(this, '暂停', items, { side: true, extra, hint: '↑/↓ 选择　确认键 决定　翻滚键 继续', hintTouch: '点选项目　·　右上角「返回」继续游戏', onClose: () => audio.duck(false) });
    pause.hallReturn = true;
    audio.duck(true);
    this.push(pause);
  }
}

export { Food, textWidth };
