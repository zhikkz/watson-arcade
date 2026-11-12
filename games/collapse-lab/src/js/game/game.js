// 游戏总控：标题 / 开局 / 关卡切换 / 死亡与通关
import { W, H, UI_W, VIEW } from '../core/config.js';
import { input, keyHint } from '../core/input.js';
import { touch } from '../core/touch.js';
import { audio } from '../core/audio.js';
import { loadSave, writeSave, resetSave, loadRunSave, writeRunSave, clearRunSave, saveStatus } from '../core/save.js';
import { G } from './state.js';
import { Run, STAGES } from './run.js';
import { World } from './world.js';
import { generateLevel, buildFixedLevel } from './levelgen.js';
import { rollItem } from './items.js';
import { UI } from './ui.js';
import { HUD } from './hud.js';
import './enemies_duli.js';
import './enemies_mech.js';
import './enemies_em.js';
import './enemies_thermo.js';
import './enemies_quantum.js';
import './bosses.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    G.game = this;
    G.save = loadSave();
    audio.setVolumes(G.save.settings.sfx, G.save.settings.music);
    touch.fixed = G.save.settings.stickFixed !== false;
    this.ui = new UI(this);
    this.hud = new HUD();
    this.world = null;
    this.fade = { a: 1, target: 0, speed: 2.2, cb: null };
    this.pending = null;       // 延时事件 {t, fn}
    this.taps = new Map();     // 触屏在菜单上按下、尚未抬起的触点
    this.ui.openTitle();
    audio.music('title');
  }

  keyLabel(action) { return keyHint(action); }

  /** 提示条：菜单里和游戏中都看得到 */
  toast(text, color) { this.hud.toast(text, color); }

  // ---------------------------------------------------------------- 存档
  /** 进行中的一局的存档点（没有则为 null） */
  get runSave() { return loadRunSave(); }

  /** 写入存档点：snap 是进入当前区域时的状态 */
  checkpoint(snap) {
    const st = STAGES[snap.stage];
    const ok = writeRunSave({ v: 1, at: Date.now(), name: st.type === 'rest' ? '茶水间' : st.name, run: snap });
    if (ok) this.hud.flashSaved();
    else if (!this.warnedStorage) { this.warnedStorage = true; this.toast('这个浏览器无法写入本地存档，进度只在本次有效', '#ff6b5e'); }
    return ok;
  }

  /** 存档点之后发生的、不能重来的事（比如数据已经上传）要同步改进存档点里 */
  patchCheckpoint(fn) {
    const s = loadRunSave();
    if (!s) return;
    fn(s.run);
    writeRunSave(s);
  }

  /** 标题画面「继续」：从存档点所在区域的入口接着玩 */
  continueRun() {
    const s = loadRunSave();
    if (!s) return false;
    let run = null;
    try { run = Run.restore(G.save, s.run); } catch (_) { run = null; }
    if (!run) { clearRunSave(); this.toast('存档已损坏，无法继续', '#ff6b5e'); return false; }
    if (VIEW.touch && !this.triedImmersive) { this.triedImmersive = true; this.enterFullscreen(); }
    G.run = run;
    this.ui.clear();
    this.transition(() => this.loadStage(run.stage));
    return true;
  }

  /** 暂停菜单「保存并退出」：存档点在进入本区域时已经写好，这里只是回到标题 */
  saveAndQuit() {
    const s = loadRunSave();
    writeSave();
    if (s && saveStatus().ok) this.toast(`已保存：下次从「${s.name}」入口继续`, '#9dffb0');
    else this.toast('这个浏览器无法写入本地存档：关掉页面后进度会丢失', '#ff6b5e');
    this.toTitle();
  }

  /** 设置里的「清除全部存档」：永久进度和进行中的一局都清掉，回到标题 */
  wipeSaves() {
    G.save = resetSave();
    audio.setVolumes(G.save.settings.sfx, G.save.settings.music);
    touch.fixed = G.save.settings.stickFixed !== false;
    audio.duck(false);
    this.toast('全部存档已清除', '#ff6b5e');
    this.toTitle();
  }

  // ---------------------------------------------------------------- 流程
  beginFromTitle() {
    // 手机：第一次开始时顺手进入全屏并锁定横屏（失败就算了，旋转布局会兜底）
    if (VIEW.touch && !this.triedImmersive) { this.triedImmersive = true; this.enterFullscreen(); }
    if (!G.save.introSeen) {
      G.save.introSeen = true; writeSave();
      this.ui.openIntro(() => this.startRun());
    } else this.startRun();
  }

  startRun(seed) {
    const save = G.save;
    clearRunSave();            // 新开一局会顶掉旧的存档点
    save.runs++;
    writeSave();
    G.run = new Run(save, seed === undefined ? (Math.random() * 0xffffffff) >>> 0 : seed);
    this.ui.clear();
    this.transition(() => this.loadStage(0));
  }

  loadStage(i) {
    const run = G.run;
    run.stage = i;
    // 存档点 = 进入本区域时的状态。必须在生成关卡之前取：随机数状态要和「继续」时对得上
    const snap = run.snapshot();
    const st = STAGES[i];
    let level;
    if (st.type === 'level') level = generateLevel(run, st.biome, (run.seed + i * 104729) >>> 0);
    else if (st.type === 'rest') level = buildFixedLevel('rest', run);
    else level = buildFixedLevel(st.boss, run);
    this.world = new World(this, level, st);
    G.world = this.world;
    this.pending = null;
    if (st.type === 'rest') { audio.music('rest'); this.hud.showBanner('茶水间', '接水、看黑板、上传数据——歇口气再走'); } else {
      audio.music(st.music);
      this.hud.showBanner(st.name, st.sub);
      if (st.type === 'boss') this.world.bossIntroT = 1.6;
    }
    if (i > (G.save.bestStage || 0)) { G.save.bestStage = i; writeSave(); }
    this.checkpoint(snap);
  }

  exitStage() {
    const run = G.run;
    if (this.fade.cb) return;
    if (run.stage === 0 && !G.save.tutorialDone) { G.save.tutorialDone = true; writeSave(); }
    const next = run.stage + 1;
    this.world.inputLocked = true;
    if (next >= STAGES.length) { this.finishRun(true); return; }
    this.transition(() => this.loadStage(next));
  }

  onBossDefeated(e) {
    const run = G.run;
    if (run.stage >= STAGES.length - 1) {
      this.pending = { t: 3.2, fn: () => this.finishRun(true) };
    } else this.hud.toast('出口已经打开', '#9dffb0');
    void e;
  }

  onDeath() { this.finishRun(false); }

  finishRun(win) {
    const run = G.run, save = G.save;
    if (!run || run.finished) return;
    run.finished = true;
    clearRunSave();            // 这一局已经结束：不能再「继续」

    let kept = 0, lost = run.data;
    if (win) { save.data += run.data; kept = run.data; lost = 0; save.wins++; save.entropy = Math.max(save.entropy || 0, run.entropy + 1); audio.music(null); audio.sfx('win'); } else {
      save.deaths++;
      kept = Math.floor(run.data * (save.unlocks.recycle ? 0.65 : 0.3));
      save.data += kept; lost = run.data - kept;
    }
    if (!save.bestTime || (win && run.time < save.bestTime)) { if (win) save.bestTime = run.time; }
    writeSave();
    const st = STAGES[Math.min(run.stage, STAGES.length - 1)];
    this.ui.openResult(win, {
      stageName: st.type === 'rest' ? '茶水间' : st.name, kills: run.kills, time: run.time, perks: run.perks.length,
      banked: win ? kept : 0, lost, kept: win ? 0 : kept, entropy: save.entropy,
    });
  }

  abandonRun() { clearRunSave(); this.toTitle(); }

  toTitle() {
    this.transition(() => {
      this.world = null; G.world = null; G.run = null;
      this.ui.openTitle();
      audio.music('title');
    });
  }

  transition(fn) {
    this.fade.target = 1; this.fade.speed = 3.2;
    this.fade.cb = () => { fn(); this.fade.target = 0; this.fade.speed = 2.4; };
  }

  rollDrop(minAffix) { return rollItem(G.run, G.run.rng, undefined, minAffix); }

  get canFullscreen() { return !!(document.fullscreenEnabled && document.documentElement.requestFullscreen); }

  /** 进入全屏；手机上同时请求把屏幕方向锁成横屏（不支持时由 main.js 的旋转布局兜底） */
  async enterFullscreen() {
    const el = document.documentElement;
    if (!this.canFullscreen) return false;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen({ navigationUI: 'hide' });
    } catch (_) { return false; }
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (_) { /* 桌面浏览器 / iOS 不支持 */ }
    return true;
  }

  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (_) { /* ignore */ }
        await document.exitFullscreen();
      } else if (!(await this.enterFullscreen())) this.hud.toast('当前环境不支持全屏', '#9aa0b4');
    } catch (_) { /* ignore */ }
  }

  // ---------------------------------------------------------------- 画面与指针
  /** 视口宽度变化后（画布被重置） */
  onResize() {
    this.ctx.imageSmoothingEnabled = false;
    if (this.world) this.world.camera.clampToBounds();
  }

  /** 菜单界面按 640 宽设计，居中摆放 */
  get uiOx() { return (W - UI_W) >> 1; }

  pointerDown(pid, x, y, isTouch) {
    if (this.ui.active) {
      const ux = x - this.uiOx;
      if (!isTouch) return this.ui.pointer(ux, y, true);
      // 触屏：按下只是高亮，抬手时还停在同一项上才算点击
      this.ui.pointer(ux, y, false);
      this.taps.set(pid, { screen: this.ui.active, hit: this.ui.hit(ux, y) });
      return true;
    }
    if (isTouch && this.world && !this.fade.cb) return touch.down(pid, x, y);
    return false;
  }

  pointerMove(pid, x, y, isTouch) {
    if (this.ui.active) { if (!isTouch) this.ui.pointer(x - this.uiOx, y, false); return; }
    if (isTouch) touch.move(pid, x, y);
  }

  pointerUp(pid, x, y, cancelled) {
    touch.up(pid);
    const tap = this.taps.get(pid);
    if (!tap) return;
    this.taps.delete(pid);
    const ux = x - this.uiOx;
    if (!cancelled && tap.hit >= 0 && this.ui.active === tap.screen && this.ui.hit(ux, y) === tap.hit) this.ui.pointer(ux, y, true);
  }

  /** 切到后台时自动暂停 */
  autoPause() {
    const w = this.world;
    if (w && !this.ui.active && !w.player.dead && !this.fade.cb && G.run && !G.run.finished) this.ui.openPause();
  }

  // ---------------------------------------------------------------- 循环
  update(dt) {
    G.time += dt; G.frame++;
    const f = this.fade;
    if (f.a !== f.target) f.a = f.a < f.target ? Math.min(f.target, f.a + f.speed * dt) : Math.max(f.target, f.a - f.speed * dt);
    // 画面全黑时执行切换（即使发起切换时本来就是全黑的）
    if (f.a === 1 && f.cb) { const cb = f.cb; f.cb = null; cb(); }
    this.hud.update(dt);
    const w = this.world;
    if (w && !this.ui.blocking && input.pressed('pause') && !w.player.dead && !f.cb) { input.consume('pause'); this.ui.openPause(); }
    if (this.ui.active) this.ui.update(dt);
    if (touch.mapOpen && (this.ui.active || !w)) touch.mapOpen = false;
    // 触屏点开的大地图会暂停世界（键盘是按住 M 边走边看）
    if (w && !this.ui.blocking && !touch.mapOpen) {
      if (w.bossIntroT > 0) { w.bossIntroT -= dt; w.inputLocked = true; if (w.bossIntroT <= 0) w.inputLocked = false; }
      w.update(dt);
      if (this.pending) { this.pending.t -= dt; if (this.pending.t <= 0) { const fn = this.pending.fn; this.pending = null; fn(); } }
    }
  }

  draw() {
    const ctx = this.ctx;
    if (this.world) { this.world.draw(ctx); this.hud.draw(ctx); } else { ctx.fillStyle = '#0a0812'; ctx.fillRect(0, 0, W, H); }
    this.ui.draw(ctx);
    if (this.fade.a > 0) { ctx.globalAlpha = this.fade.a; ctx.fillStyle = '#07060c'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    this.hud.drawToast(ctx, !!this.ui.active || !this.world);
  }
}
