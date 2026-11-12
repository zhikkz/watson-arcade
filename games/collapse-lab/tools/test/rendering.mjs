import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameClock } from '../../src/js/core/clock.js';
import { inView } from '../../src/js/core/viewport.js';
import { W, H, VIEW, setViewWidth } from '../../src/js/core/config.js';
import { assets } from '../../src/js/core/assets.js';
import { drawText } from '../../src/js/core/font.js';
import { FX, pxLine } from '../../src/js/game/fx.js';
import { Lighting } from '../../src/js/game/lighting.js';
import { makeHazard } from '../../src/js/game/hazards.js';
import { G } from '../../src/js/game/state.js';
import { World } from '../../src/js/game/world.js';

function context() {
  return {
    globalAlpha: 1, calls: [],
    drawImage(...args) { this.calls.push(['image', ...args]); },
    fillRect(...args) { this.calls.push(['rect', ...args]); },
    setTransform(...args) { this.calls.push(['transform', ...args]); },
  };
}
let canvases = 0;
globalThis.document = { createElement() {
  canvases++;
  const ctx = context();
  return { width: 0, height: 0, getContext: () => ctx };
} };

test('60/90/120/144 Hz displays all advance 60 physics steps and at most 60 draws per second', () => {
  for (const hz of [60, 90, 120, 144]) {
    const clock = new FrameClock(0);
    let steps = 0, draws = 0;
    for (let i = 1; i <= hz; i++) {
      const n = clock.advance(i * 1000 / hz);
      steps += n; if (n) draws++;
    }
    assert.equal(steps, 60, `${hz} Hz physics`);
    assert.equal(draws, 60, `${hz} Hz rendering`);
  }
});

test('slow frames have bounded catch-up and background time never advances physics', () => {
  const clock = new FrameClock(0);
  assert.equal(clock.advance(2000), 4);
  assert.equal(clock.advance(2000), 0);
  assert.equal(clock.advance(3000, true), 0);
  assert.equal(clock.advance(3010), 0);
  clock.reset(100000);
  assert.equal(clock.advance(100000), 0);
  assert.equal(clock.advance(100017), 1);
});

test('viewport culling follows live screen width and accepts crossing/reversed bounds', () => {
  const original = W;
  try {
    setViewWidth(800);
    assert.ok(inView(790, 100, 810, 110, 0, 0));
    assert.ok(inView(1000, 100, -100, 110, 0, 0));
    assert.ok(inView(-6, 100, -6, 100, 0, 0, 8));
    assert.ok(!inView(900, 100, 910, 110, 0, 0));
    assert.ok(!inView(0, H + 20, 10, H + 30, 0, 0));
    assert.ok(inView(1200, 700, 1250, 750, 1000, 600));
  } finally { setViewWidth(original); }
});

test('hazard bounds retain beams, swinging weights, extended crushers and falling icicles', () => {
  G.run = { depth: 0 };
  const world = { level: { biome: 'quantum', groundBelow: () => 300, isSolid: () => true, raycast: () => 400 } };
  const beam = makeHazard({ type: 'hazard', kind: 'beam', mount: 'floor', x: -300, y: 150 }, world);
  assert.ok(beam.visible(0, 0), 'offscreen emitter can fire into the screen');
  assert.ok(!beam.visible(2000, 0));
  const laser = makeHazard({ type: 'hazard', kind: 'laser', x: 100, y: -100 }, world);
  laser.ex = 200; laser.ey = 100;
  assert.ok(laser.visible(0, 0));
  const arc = makeHazard({ type: 'hazard', kind: 'arc', mount: 'ceil', x: 100, y: -100 }, world);
  assert.ok(arc.visible(0, 0));
  const pendulum = makeHazard({ type: 'hazard', kind: 'pendulum', x: -40, y: 10 }, world);
  pendulum.bx = 30; pendulum.by = 90;
  assert.ok(pendulum.visible(0, 0));
  const crusher = makeHazard({ type: 'hazard', kind: 'crusher', x: 100, y: -100 }, world);
  crusher.cy = 200;
  assert.ok(crusher.visible(0, 0));
  const icicle = makeHazard({ type: 'hazard', kind: 'icicle', x: 100, y: -100 }, world);
  assert.ok(!icicle.visible(0, 0));
  icicle.iy = 180;
  assert.ok(icicle.visible(0, 0), 'falling tip remains visible after its mount leaves view');
});

test('world rendering culls offscreen objects while keeping edge objects and nearby light spill', () => {
  const drawn = [], lit = [], noop = () => {};
  const thing = (id, x, y) => ({ x, y, w: 16, h: 24, light: id, draw: () => drawn.push(id) });
  const hazard = (id, x) => ({ x, y: 100, emissive: true, visible: (cx, cy) => inView(x, 80, x + 10, 120, cx, cy), draw: () => drawn.push(id), addLights: () => lit.push(id) });
  const world = Object.assign(Object.create(World.prototype), {
    camera: { vx: 0, vy: 0 }, level: { biome: 'mech', lights: [], drawLayer: noop },
    biome: { ambient: '#787896' }, time: 0, visibleHazards: [],
    player: { x: 100, cy: 100, draw: () => drawn.push('player') },
    hazards: [hazard('on', 100), hazard('off', 2000)],
    props: [thing('prop', 100, 100), thing('edge', W + 10, 100), thing('off-prop', 2000, 100)],
    pickups: [thing('pickup', 100, 100), thing('off-pickup', 100, -2000)],
    enemies: [], actors: [], projs: [],
    fx: { drawBack: noop, draw: noop, drawTexts: noop, forEachLight: noop },
    lighting: { begin: noop, add: (_x, _y, _r, color) => lit.push(color), render: noop },
    drawLiquid: noop, drawPrompt: noop,
  });
  world.draw(context());
  assert.deepEqual(drawn, ['prop', 'edge', 'pickup', 'player', 'on']);
  assert.ok(lit.includes('off'), 'offscreen attack may still illuminate a visible edge');
  assert.equal(world.hazards.length, 2, 'culling must not remove live hazards');
  assert.equal(world.props.length, 3);
});

test('cosmetic particle storage stays bounded and expired slots can be reused', () => {
  try {
    for (const [touch, limit] of [[true, 256], [false, 768]]) {
      VIEW.touch = touch;
      const fx = new FX();
      for (let i = 0; i < 20; i++) fx.burst(100, 100, 100);
      assert.equal(fx.parts.length, limit);
      fx.update(10);
      assert.equal(fx.parts.length, 0);
      fx.burst(100, 100, 12);
      assert.equal(fx.parts.length, 12);
    }
  } finally { VIEW.touch = false; }
});

test('offscreen particle lights do not consume the budget; attack lights remain', () => {
  VIEW.touch = true;
  try {
    const fx = new FX();
    fx.burst(100, 100, 40, { light: 1 });
    fx.burst(20000, 20000, 100, { light: 1 });
    fx.bolt(20, 20, 150, 80);
    const lights = [];
    fx.forEachLight((...light) => lights.push(light), 0, 0);
    assert.equal(lights.length, 22);
    assert.ok(lights.every(([x, y]) => x < 200 && y < 200));
    assert.equal(lights.at(-1)[0], 150);
  } finally { VIEW.touch = false; }
});

test('touch lighting reduces only the light buffer, retaining native output dimensions on resize', () => {
  const original = W;
  const light = new Lighting(), ctx = context();
  try {
    VIEW.touch = true; setViewWidth(800);
    light.begin('#787896'); light.render(ctx);
    assert.equal(light.canvas.width * light.canvas.height, 800 * H / 4);
    assert.deepEqual(ctx.calls.at(-1).slice(2), [0, 0, 800, H]);
    assert.deepEqual(light.ctx.calls[0], ['transform', 0.5, 0, 0, 0.5, 0, 0]);
    VIEW.touch = false; setViewWidth(640);
    light.begin('#787896');
    assert.equal(light.canvas.width, 640); assert.equal(light.canvas.height, H);
  } finally { VIEW.touch = false; setViewWidth(original); }
});

test('warm outlined text uses two blits and survives cache churn without recreating hot labels', () => {
  assets.fontImg = {};
  assets.font = { 12: { h: 12, g: { '?': [0, 0, 6], ' ': [0, 0, 4] } } };
  const ctx = context(), opts = { size: 12, outline: '#14101a', align: 'center', alpha: 0.5 };
  drawText(ctx, 'static-label', 100, 50, opts);
  ctx.calls.length = 0;
  const before = canvases;
  drawText(ctx, 'static-label', 100, 50, opts);
  assert.equal(ctx.calls.length, 2);
  assert.equal(canvases, before);
  assert.equal(ctx.globalAlpha, 1);
  assert.equal(ctx.calls[0][2], 63); // 12 glyphs * 6 px, plus outline padding
  for (let i = 0; i < 1000; i++) {
    drawText(ctx, String(i), 0, 0, opts);
    const allocated = canvases;
    drawText(ctx, 'static-label', 100, 50, opts);
    assert.equal(canvases, allocated, `hot label at cache churn ${i}`);
  }
});

test('pixel lines reject fully offscreen work but retain segments crossing the viewport', () => {
  const ctx = context();
  pxLine(ctx, -200, -200, -50, -50, '#ffffff');
  assert.equal(ctx.calls.length, 0);
  pxLine(ctx, -20, 30, 20, 30, '#ffffff');
  assert.ok(ctx.calls.some((c) => c[1] === 0 && c[2] === 30));
});
