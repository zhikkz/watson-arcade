import { W, H } from './config.js';

// Bounds may be unordered (e.g. a beam whose emitter is outside the viewport).
// Use the rendered camera position, including shake, rather than entity centres.
export function inView(x0, y0, x1, y1, cx, cy, margin = 0) {
  return Math.max(x0, x1) + margin >= cx && Math.min(x0, x1) - margin <= cx + W
    && Math.max(y0, y1) + margin >= cy && Math.min(y0, y1) - margin <= cy + H;
}
