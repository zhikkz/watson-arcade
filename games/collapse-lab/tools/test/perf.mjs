// Reproducible mobile rendering benchmark. Compare the same built HTML before/after:
// CHROMIUM_PATH=/usr/bin/chromium PERF_CPU_RATE=4 node tools/test/perf.mjs [index.html]
// Timings are browser-emulated measurements, not measurements on a physical phone.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = resolve(process.argv[2] || join(root, 'dist', 'index.html'));
const cpuRate = Number(process.env.PERF_CPU_RATE || 4);
const frames = Number(process.env.PERF_FRAMES || 180);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const results = [];
  for (const scene of ['exploration', 'combat']) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      // Disable the normal loop so it cannot interfere with controlled frames.
      window.__perfRAF = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = () => 0;
      let seed = 117;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => window.__cl, null, { polling: 50 });
    const result = await page.evaluate(async ({ scene, frames }) => {
      const c = window.__cl, { G, game, input } = c;
      G.save.introSeen = G.save.tutorialDone = true;
      G.save.settings.shake = false;
      game.startRun(11);
      game.fade.cb?.(); game.fade.cb = null;
      game.fade.a = game.fade.target = 0;
      game.loadStage(scene === 'combat' ? 8 : 2);
      game.ui.clear(); game.hud.banner = null; game.hud.savedT = 0;
      const w = G.world, p = w.player, run = G.run;
      run.hp = run.maxHp = 1000000;
      p.invuln = 1000000;
      if (scene === 'combat') {
        const ids = ['cat', 'quark', 'neutrino', 'singlet', 'duli', 'scope', 'sentinel', 'grad'];
        for (let i = 0; i < 24; i++) {
          const e = c.spawn(ids[i % ids.length], p.x + 40 + (i % 12) * 40, p.y - (i % 3) * 30, {});
          e.aggro = true; e.hp = e.maxHp = 1000000; w.addEnemy(e);
        }
        run.weapons[0] = c.makeItem('gloves', 5, run.rng, 2);
      }
      const tick = (i) => {
        input.simulate('atk1', scene === 'combat' && i % 4 < 2);
        input.beginStep(); game.update(1 / 60); input.endStep();
        if (scene === 'combat' && i % 6 === 0) {
          w.fx.sparks(p.x + 50, p.cy, '#bfe9ff', 12);
          w.fx.bolt(p.x, p.cy, p.x + 180, p.cy - 60, '#bfe9ff', 0.2);
          w.fx.ring(p.x + 90, p.cy, '#bfe9ff', 4, 80, 0.4);
        }
      };
      // Warm up at presentation cadence too: a tight draw loop queues a large
      // raster backlog and would count its drain as artificial measured stalls.
      for (let i = 0; i < 60; i++) {
        await new Promise(window.__perfRAF);
        tick(i); game.draw();
      }
      const times = { update: [], draw: [], frameInterval: [] };
      let last;
      for (let i = 0; i < frames; i++) {
        const stamp = await new Promise(window.__perfRAF);
        if (last !== undefined) times.frameInterval.push(stamp - last);
        last = stamp;
        const t0 = performance.now(); tick(i);
        const t1 = performance.now(); game.draw();
        const t2 = performance.now();
        times.update.push(t1 - t0); times.draw.push(t2 - t1);
      }
      // Count all Canvas calls separately, avoiding measurement overhead in timings.
      const calls = {};
      const proto = CanvasRenderingContext2D.prototype, originals = {};
      for (const key of ['fillRect', 'drawImage', 'setTransform']) {
        originals[key] = proto[key];
        proto[key] = function (...args) { calls[key] = (calls[key] || 0) + 1; return originals[key].apply(this, args); };
      }
      game.draw();
      for (const key in originals) proto[key] = originals[key];
      const stats = (a) => {
        const sorted = a.slice().sort((a, b) => a - b);
        const round = (n) => +n.toFixed(3);
        return { mean: round(a.reduce((s, n) => s + n, 0) / a.length), p95: round(sorted[Math.floor(sorted.length * 0.95)]), max: round(sorted.at(-1)) };
      };
      return {
        scene, frames, viewport: [c.W, 360], updateMs: stats(times.update), drawMs: stats(times.draw),
        frameIntervalMs: stats(times.frameInterval),
        over25ms: times.frameInterval.filter((n) => n > 25).length,
        calls, enemies: w.enemies.length, particles: w.fx.parts.length,
      };
    }, { scene, frames });
    assert.deepEqual(errors, [], 'game should run without browser errors');
    results.push(result);
    await context.close();
  }
  console.log(JSON.stringify({ cpuRate, results }, null, 2));
} finally { await browser.close(); }
