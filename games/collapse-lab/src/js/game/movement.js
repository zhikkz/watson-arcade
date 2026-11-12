// 主角与关卡校验共用移动尺寸，避免生成器假设角色能穿过实际过不去的空间。
import { TILE } from '../core/config.js';

export const BODY_W = 14, STAND_H = 50, ROLL_H = 28;
export const RUN = 152, ACC_G = 1900, ACC_A = 1300, FRIC = 2300;
export const JUMP_V = 505, DJUMP_V = 445, JUMP_CUT = 190;

/** 攀沿的目标位置；主角动画和生成器必须使用相同的墙沿、身高与头顶空间判定。 */
export function ledgeTarget(level, body, dir) {
  const tx = Math.floor((body.x + dir * (body.w / 2 + 2)) / TILE);
  const top = body.y - body.h;
  for (let ty = Math.floor((top - 4) / TILE); ty <= Math.floor((top + 30) / TILE); ty++) {
    if (!level.isSolid(tx, ty) || level.isSolid(tx, ty - 1)) continue;
    const y = ty * TILE;
    if (y < top - 6 || y > top + 30) continue;
    const x = dir > 0 ? tx * TILE + body.w / 2 + 2 : (tx + 1) * TILE - body.w / 2 - 2;
    if (level.rectSolid(x - body.w / 2, y - STAND_H, body.w, STAND_H)) continue;
    if (level.rectSolid(body.x - body.w / 2, y - STAND_H, body.w, body.y - (y - STAND_H) - 1)) continue;
    return { x, y };
  }
  return null;
}
