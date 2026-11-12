// 远景：房间墙体之外的底色（夜色渐变 + 星点），被背景墙挡住的地方看不到
import { W, H } from '../core/config.js';
import { BIOMES } from './biomes.js';
import { RNG } from '../core/util.js';

const cache = new Map();

function build(biome) {
  const B = BIOMES[biome] || BIOMES.mech;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bands = B.sky;
  const bh = Math.ceil(H / bands.length);
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bh, W, bh); });
  const rng = new RNG(biome.length * 977 + 13);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = rng.chance(0.3) ? '#ffffff' : '#8fa0d8';
    g.globalAlpha = rng.range(0.3, 0.9);
    g.fillRect(rng.int(0, W - 1), rng.int(0, H - 1), 1, 1);
  }
  g.globalAlpha = 1;
  return c;
}

export function drawBackdrop(ctx, biome) {
  // 视口宽度会随屏幕比例变化：按「区域 + 宽度」缓存
  const key = biome + '@' + W;
  let c = cache.get(key);
  if (!c) { if (cache.size > 12) cache.clear(); c = build(biome); cache.set(key, c); }
  ctx.drawImage(c, 0, 0);
}
