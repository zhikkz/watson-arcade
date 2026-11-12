// 位图字体渲染：逐字 blit，支持颜色标记、描边/阴影、自动换行
import { assets } from './assets.js';

const segCache = new Map();   // 「字号|颜色|文本片段」 -> 画好的小画布
const tokenCache = new Map();
const outlineCache = new Map();

function remember(cache, key, value, limit) {
  // Evict one old entry; clearing a whole cache caused periodic rasterization spikes.
  if (cache.size >= limit) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

function cached(cache, key) {
  const value = cache.get(key);
  if (value) { cache.delete(key); cache.set(key, value); }
  return value;
}

/** 把一段同色文字画成一张小画布并缓存（比整张字体图集按颜色各存一份省得多） */
function segment(F, size, str, color) {
  const key = size + '|' + color + '|' + str;
  let c = cached(segCache, key);
  if (!c) {
    let w = 0;
    for (let i = 0; i < str.length; i++) w += glyphOf(F, str[i])[2];
    c = document.createElement('canvas');
    c.width = Math.max(1, w); c.height = F.h;
    const g = c.getContext('2d');
    let x = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i], gl = glyphOf(F, ch);
      if (ch !== ' ' && ch !== '\u3000') g.drawImage(assets.fontImg, gl[0], gl[1], gl[2], F.h, x, 0, gl[2], F.h);
      x += gl[2];
    }
    if (color !== '#ffffff') { g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); }
    remember(segCache, key, c, 800);
  }
  return c;
}

// 文本内的颜色标记：{y}黄色{/}  支持的键见 TAGS
const TAGS = {
  w: '#ffffff', y: '#ffd24a', r: '#ff6b5e', g: '#7be07b', b: '#6cc4ff', p: '#c98bff',
  o: '#ff9a4a', c: '#62e6ff', d: '#9aa0b4', k: '#14101a', m: '#ff7ad9',
};

function tokenize(text) {
  const hit = cached(tokenCache, text);
  if (hit) return hit;
  // -> [{ch, color|null}]，color 为 null 表示用默认色
  const out = [];
  let color = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      const end = text.indexOf('}', i);
      if (end > i && end - i <= 9) {
        const tag = text.slice(i + 1, end);
        if (tag === '/' || tag === '') { color = null; i = end; continue; }
        if (TAGS[tag]) { color = TAGS[tag]; i = end; continue; }
        if (tag[0] === '#' && (tag.length === 7 || tag.length === 4)) { color = tag; i = end; continue; }
      }
    }
    out.push({ ch, color });
  }
  return remember(tokenCache, text, out, 512);
}

function glyphOf(F, ch) {
  if (ch === '\u3000') return F.wide || (F.wide = [F.g[' '][0], F.g[' '][1], F.h]);
  return F.g[ch] || F.g['?'];
}

export function stripTags(text) {
  return tokenize(String(text)).map((t) => t.ch).join('');
}

export function textWidth(text, size = 12) {
  const F = assets.font[size];
  let w = 0, max = 0;
  for (const t of tokenize(String(text))) {
    if (t.ch === '\n') { max = Math.max(max, w); w = 0; continue; }
    w += glyphOf(F, t.ch)[2];
  }
  return Math.max(max, w);
}

const NO_LINE_START = '，。；：！？、）》」』”’％%．,.;:!?)';

/** 按最大宽度折行（中文任意处可断，英文单词尽量不拆） */
export function wrapText(text, size, maxWidth) {
  const F = assets.font[size];
  const toks = tokenize(String(text));
  const lines = [];
  let line = [], w = 0, lastSpace = -1;
  const flush = () => { lines.push(line); line = []; w = 0; lastSpace = -1; };
  for (const t of toks) {
    if (t.ch === '\n') { flush(); continue; }
    const gw = glyphOf(F, t.ch)[2];
    if (w + gw > maxWidth && line.length && !NO_LINE_START.includes(t.ch)) {
      const isLatin = /[A-Za-z0-9]/.test(t.ch);
      if (isLatin && lastSpace >= 0 && lastSpace < line.length - 1) {
        const rest = line.splice(lastSpace + 1);
        flush();
        line = rest;
        for (const r of rest) w += glyphOf(F, r.ch)[2];
      } else {
        flush();
        if (t.ch === ' ') continue;
      }
    }
    if (t.ch === ' ') lastSpace = line.length;
    line.push(t);
    w += gw;
  }
  if (line.length || !lines.length) lines.push(line);
  return lines;
}

function drawLine(ctx, F, toks, x, y, color, dx = 0, dy = 0, forceColor = null) {
  let cx = x + dx;
  let i = 0;
  while (i < toks.length) {
    // 把连续同色的字合并成一段
    const col = forceColor || toks[i].color || color;
    let str = '';
    while (i < toks.length && (forceColor || toks[i].color || color) === col) { str += toks[i].ch; i++; }
    const c = segment(F, F.h, str, col);
    ctx.drawImage(c, cx, y + dy);
    cx += c.width;
  }
}

function lineWidth(F, toks) {
  let w = 0;
  for (const t of toks) w += glyphOf(F, t.ch)[2];
  return w;
}

function drawOutline(ctx, F, toks, x, y, color) {
  const text = toks.map((t) => t.ch).join('');
  const key = F.h + '|' + color + '|' + text;
  let c = cached(outlineCache, key);
  if (!c) {
    const mask = segment(F, F.h, text, color);
    c = document.createElement('canvas');
    c.width = mask.width + 2; c.height = F.h + 2;
    const g = c.getContext('2d');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.drawImage(mask, 1 + dx, 1 + dy);
    }
    remember(outlineCache, key, c, 512);
  }
  ctx.drawImage(c, x - 1, y - 1);
}

/**
 * 绘制文本。
 * opts: size(12|10|8) color align('left'|'center'|'right') shadow outline maxWidth lineGap alpha
 * 返回绘制的总高度。
 */
export function drawText(ctx, text, x, y, opts = {}) {
  const size = opts.size || 12;
  const F = assets.font[size];
  const color = opts.color || '#ffffff';
  const align = opts.align || 'left';
  const gap = opts.lineGap === undefined ? (size === 12 ? 3 : 2) : opts.lineGap;
  const lines = opts.maxWidth ? wrapText(text, size, opts.maxWidth) : String(text).split('\n').map(tokenize);
  x = Math.round(x); y = Math.round(y);
  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha * opts.alpha;
  let cy = y;
  for (const toks of lines) {
    let lx = x;
    if (align !== 'left') {
      const w = lineWidth(F, toks);
      lx = align === 'center' ? Math.round(x - w / 2) : x - w;
    }
    if (opts.outline) {
      drawOutline(ctx, F, toks, lx, cy, opts.outline);
    } else if (opts.shadow) {
      drawLine(ctx, F, toks, lx, cy, color, 1, 1, opts.shadow);
    }
    drawLine(ctx, F, toks, lx, cy, color);
    cy += F.h + gap;
  }
  ctx.globalAlpha = prevAlpha;
  return cy - y;
}

export function textHeight(text, size, maxWidth, lineGap) {
  const F = assets.font[size];
  const gap = lineGap === undefined ? (size === 12 ? 3 : 2) : lineGap;
  const n = maxWidth ? wrapText(text, size, maxWidth).length : String(text).split('\n').length;
  return n * (F.h + gap) - gap;
}

// ---------------------------------------------------------------- 放大文字（标题用）
const bigCache = new Map();

/** 以整数倍放大绘制文本（最近邻），用于标题等大字 */
export function drawTextBig(ctx, text, x, y, scale, opts = {}) {
  const size = opts.size || 12;
  const key = [text, scale, size, opts.color, opts.outline, opts.shadow].join('|');
  let c = bigCache.get(key);
  if (!c) {
    const w = textWidth(text, size) + 4, h = assets.font[size].h + 4;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    drawText(tmp.getContext('2d'), text, 2, 2, { size, color: opts.color, outline: opts.outline, shadow: opts.shadow });
    c = document.createElement('canvas');
    c.width = w * scale; c.height = h * scale;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, 0, 0, w * scale, h * scale);
    if (bigCache.size > 60) bigCache.clear();
    bigCache.set(key, c);
  }
  const align = opts.align || 'left';
  const dx = align === 'center' ? Math.round(x - c.width / 2) : align === 'right' ? x - c.width : x;
  const prev = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prev * opts.alpha;
  ctx.drawImage(c, dx, Math.round(y));
  ctx.globalAlpha = prev;
  return c.width;
}
