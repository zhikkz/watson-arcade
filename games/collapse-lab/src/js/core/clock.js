import { STEP } from './config.js';

// Physics and presentation both run at 60 Hz, including on 90/120/144 Hz phones.
// A delayed frame can catch up at most four steps; background time is discarded.
export class FrameClock {
  constructor(now) { this.reset(now); }
  reset(now) { this.last = now; this.acc = 0; }
  advance(now, hidden = false) {
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    if (hidden) { this.acc = 0; return 0; }
    this.acc += dt;
    const steps = Math.min(4, Math.floor((this.acc + 1e-9) / STEP));
    this.acc = steps === 4 ? 0 : Math.max(0, this.acc - steps * STEP);
    return steps;
  }
}
