// 嘟礼 —— 用户设计的招牌怪物（素材：待机 / 追击 / 扑击 / 爪击 / 蹲伏）
import { audio } from '../core/audio.js';
import { clamp, rnd, sign } from '../core/util.js';
import { Enemy, registerEnemy } from './enemy.js';

const IDLE_DUR = [0.2, 0.2, 0.2, 0.18, 0.1, 0.2];
const CLAW_END = [0.18, 0.33, 0.40, 0.52, 0.61, 0.79];

export const DULI = {
  id: 'duli', name: '嘟礼', spr: 'duli', hp: 85, w: 22, h: 42, speed: 108, kbResist: 0.35,
  gold: [6, 10], data: 3, blood: ['#b3ad8a', '#56634a', '#3a3340'],
  tip: '扑击前会先蹲下蓄力——看到它压低身体就翻滚。',
  desc: '实验事故里变异的壮汉，这座实验楼的招牌住户。平时驼着背踱步，一旦盯上你就会狂奔、飞扑、挥爪，偶尔还会蹲下硬扛一击再反手还击。',
};

export class Duli extends Enemy {
  constructor(def, x, y, o) {
    super(def, x, y, o);
    this.pounceCd = rnd(0.8, 2.2);
    this.guardCd = rnd(1, 3);
    this.hitDone = false;
    this.swung = false;
    this.second = false;
    this.loseT = 0;
  }

  onAggro() { if (this.state === 'idle') { this.setState('alert'); this.facePlayer(); audio.sfx('growl', { gap: 0.3 }); } }

  onInterrupt() {
    if (this.state !== 'idle') this.setState('chase');
    this.superArmor = false; this.swung = false; this.second = false;
  }

  modifyDamage(dmg, info) {
    if (this.state === 'guard' && info.src !== 'dot') {
      if (!info.quiet) this.world.fx.text(this.x, this.y - this.h - 14, '硬扛', '#d8d2b0', { size: 10 });
      return dmg * 0.35;
    }
    return dmg;
  }

  ai(dt) {
    const p = this.player, w = this.world;
    const dx = this.dx(), adx = Math.abs(dx), dyv = p.y - this.y;
    this.pounceCd -= dt; this.guardCd -= dt;
    this.superArmor = this.state === 'claw' || this.state === 'pounceAir' || this.state === 'guard';
    switch (this.state) {
      case 'idle':
        this.patrol(dt, 30);
        if (this.aggro || this.noticePlayer(210, 80, 70)) {
          this.aggro = true; this.setState('alert'); this.facePlayer(); this.telegraph(0.3, '#ffcf4a'); audio.sfx('growl', { gap: 0.3 });
        }
        break;
      case 'alert':
        this.stop(dt);
        if (this.stateT > 0.42) this.setState('chase');
        break;
      case 'chase': {
        if (p.dead) { this.setState('idle'); this.aggro = false; break; }
        this.facePlayer();
        const sameLevel = Math.abs(dyv) < 34;
        if (adx < 42 && sameLevel && this.onGround) { this.startClaw(); break; }
        if (adx > 64 && adx < 175 && Math.abs(dyv) < 76 && this.pounceCd <= 0 && this.onGround && w.level.los(this.x, this.cy, p.x, p.cy)) { this.setState('pounceWind'); this.telegraph(0.28); break; }
        // 玩家贴脸出招时，偶尔蹲下硬扛再反击
        if (this.guardCd <= 0 && adx < 64 && sameLevel && p.state === 'attack' && this.onGround && Math.random() < 0.5) { this.guardCd = rnd(3.5, 6); this.setState('guard'); break; }
        if (this.onGround && this.wallAhead(this.facing) && this.lowWallAhead(this.facing, 3)) this.vy = -480;
        const edge = this.onGround && this.edgeAhead(this.facing);
        if (edge && dyv < 26) {
          this.stop(dt);
          if (this.pounceCd <= 0.6 && adx < 210 && adx > 40) { this.setState('pounceWind'); this.telegraph(0.28); }
        } else if (adx > 24) this.walk(dt, this.facing, this.def.speed);
        else this.stop(dt);
        if (adx > 430 || Math.abs(dyv) > 230) { this.loseT += dt; if (this.loseT > 3) { this.setState('idle'); this.aggro = false; this.loseT = 0; } } else this.loseT = 0;
        break;
      }
      case 'claw': {
        const t = this.stateT;
        if (t < 0.33) this.stop(dt);
        else if (t < 0.52) {
          this.walk(dt, this.facing, 150, 3200);
          if (!this.swung) {
            this.swung = true; audio.sfx('swing');
            const f = this.facing;
            w.fx.slash(this.x + f * 12, this.y - 24, 22, f > 0 ? -1.2 : Math.PI + 1.2, f > 0 ? 0.9 : Math.PI - 0.9, '#e9e2c0', 0.14, 6);
          }
          if (!this.hitDone && this.hitFront(44, 14, { top: 44, h: 40 })) this.hitDone = true;
        } else this.stop(dt);
        if (t > 0.79) {
          if (this.elite && !this.second && Math.abs(this.dx()) < 70) { this.second = true; this.facePlayer(); this.startClaw(0.2); } else { this.second = false; this.setState('chase'); }
        }
        break;
      }
      case 'pounceWind':
        this.stop(dt);
        if (this.stateT < 0.2) this.facePlayer();
        if (this.stateT > 0.29) {
          this.setState('pounceAir');
          this.hitDone = false;
          this.vx = this.facing * clamp(adx / 0.46, 190, 400);
          this.vy = -345 - clamp(-dyv, 0, 60) * 1.6;
          this.onGround = false;
          this.pounceCd = this.elite ? rnd(1.6, 2.6) : rnd(2.6, 4.2);
          audio.sfx('growl', { gap: 0.2 });
        }
        break;
      case 'pounceAir':
        if (!this.hitDone && this.hitPlayerRect(this.x - 14 + this.facing * 8, this.y - 40, 30, 36, 18, { kb: 220 })) this.hitDone = true;
        if (this.hitWall) this.vx = 0;
        if (this.onGround && this.stateT > 0.08) {
          this.setState('pounceLand');
          this.vx *= 0.3;
          w.fx.dust(this.x - 10, this.y, -1, 5); w.fx.dust(this.x + 10, this.y, 1, 5);
          w.shake(2.5, 0.15); audio.sfx('land');
        }
        break;
      case 'pounceLand':
        this.stop(dt, 1600);
        if (this.stateT > 0.36) this.setState('chase');
        break;
      case 'guard':
        this.stop(dt);
        if (this.stateT > 0.55) { this.facePlayer(); this.startClaw(0.16); }
        break;
      default: this.setState('idle');
    }
  }

  startClaw(skip = 0) {
    this.setState('claw');
    this.stateT = skip;
    this.hitDone = false; this.swung = false;
    this.telegraph(0.3 - skip);
  }

  frameName() {
    if (this.stunT > 0) return 'duli/crouch/3';
    const idle = () => { let t = this.t % 1.08, i = 0; while (i < 5 && t > IDLE_DUR[i]) { t -= IDLE_DUR[i]; i++; } return 'duli/idle/' + i; };
    switch (this.state) {
      case 'idle': return Math.abs(this.vx) > 8 ? 'duli/chase/' + (Math.floor(this.t / 0.17) % 6) : idle();
      case 'alert': return 'duli/crouch/' + [1, 2, 3, 2, 1][Math.min(4, Math.floor(this.stateT / 0.085))];
      case 'chase': return Math.abs(this.vx) > 12 ? 'duli/chase/' + (Math.floor(this.t / 0.09) % 6) : idle();
      case 'claw': { let i = 0; while (i < 5 && this.stateT > CLAW_END[i]) i++; return 'duli/claw/' + i; }
      case 'pounceWind': return this.stateT < 0.16 ? 'duli/pounce/0' : 'duli/pounce/1';
      case 'pounceAir': return this.stateT < 0.06 ? 'duli/pounce/2' : this.vy < -130 ? 'duli/pounce/3' : this.vy < 150 ? 'duli/pounce/4' : 'duli/pounce/5';
      case 'pounceLand': return this.stateT < 0.14 ? 'duli/pounce/6' : 'duli/pounce/7';
      case 'guard': return 'duli/crouch/' + [1, 2, 3, 3, 3, 3, 4][Math.min(6, Math.floor(this.stateT / 0.08))];
      default: return idle();
    }
  }
}

registerEnemy(DULI, Duli);
export { sign };
