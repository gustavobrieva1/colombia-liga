// =============================================================================
// save.js  —  Controlador de ATAJADA (jugador ataja, POV desde el arco). El NPC
// dispara y el jugador se lanza con un swipe: la dirección elige el palo, la
// ALTURA del trazo la altura, el largo/flick la EXTENSIÓN, y el INSTANTE del
// gesto es el timing. No es un botón: es su propia mecánica de skill.
// Diseño: atajar se premia más que anotar (ver REWARDS en config).
// =============================================================================
import { SAVE, WORLD, CAMERAS } from './config.js';
import { Ball } from './engine.js';
import { aiShot } from './ai.js';
import { clamp } from './input.js';

export class SaveController {
  constructor(ctx) {
    this.ctx = ctx;
    this.cam = CAMERAS.keeper;
    this.ball = new Ball();
    this.subs = [];
  }

  enter(opts = {}) {
    this.phase = 'ready';    // ready -> flight -> done
    this.resolved = false;
    this.result = null;
    this.dived = false;
    this.gloves = { x: 0, y: 0.15, ext: 0 };      // guantes en 1ª persona
    this.diveTarget = null;
    this.swipeAtT = null;
    this.readyT = 0.5;       // pequeña pausa antes del disparo

    // El NPC prepara su disparo.
    const shot = aiShot(this.ctx.difficulty);
    this._shot = shot;
    this.crossT = shot.targetCross ? shot.targetCross.t : 1.0;

    const { bus, input, hud } = this.ctx;
    hud.role('save', '¡A TAPAR!');
    hud.hint('Leé el disparo y deslizá hacia el palo. La altura del trazo = altura de la estirada. El TIMING manda.');
    this.subs.push(bus.on('swipe', g => this._dive(g)));
    input.enable();
  }

  exit() {
    this.subs.forEach(off => off()); this.subs = [];
    this.ctx.input.disable();
    this.ctx.hud.hint(null);
  }

  _dive(g) {
    if (this.phase !== 'flight' || this.dived) return;
    this.dived = true;
    this.swipeAtT = this.ball.t;                 // instante del gesto (reloj de vuelo)
    const divX = clamp(g.dirX / 0.3, -1, 1);
    const divY = clamp(-g.dirY / 0.4, 0, 1);
    const ext = clamp(g.power, 0, 1);
    this.diveTarget = {
      handX: divX * SAVE.maxReachX,
      handY: 0.4 + divY * SAVE.maxReachY,
      ext,
      glove: { x: divX, y: divY, ext },
    };
    this.ctx.bus.emit('sfx', 'dive');
  }

  update(dt) {
    if (this.phase === 'ready') {
      this.readyT -= dt;
      if (this.readyT <= 0) {
        this.ball.launch(this._shot.vel, this._shot.spin);
        this.phase = 'flight';
        this.ctx.bus.emit('sfx', 'kick');
      }
      return;
    }
    if (this.phase === 'flight') {
      // Anima los guantes hacia el objetivo de estirada.
      if (this.diveTarget) {
        const gt = this.diveTarget.glove;
        this.gloves.x += (gt.x - this.gloves.x) * Math.min(1, dt * 12);
        this.gloves.y += (gt.y - this.gloves.y) * Math.min(1, dt * 12);
        this.gloves.ext += (gt.ext - this.gloves.ext) * Math.min(1, dt * 12);
      }
      this.ball.step(dt);
      if (!this.ball.alive || (this.ball.crossed && this.ball.t > this.ball.crossed.t + 0.12)) {
        this._resolve();
      }
    }
  }

  _resolve() {
    if (this.resolved) return; this.resolved = true;
    const cross = this.ball.crossed;
    const hw = WORLD.goalWidth / 2;
    const reflexN = this.ctx.profile.statN('reflex');
    const reachN = this.ctx.profile.statN('reach');

    let outcome = 'goal';   // por defecto, si no reaccionás, es gol
    const onTarget = cross && Math.abs(cross.x) <= hw && cross.y >= 0 && cross.y <= WORLD.goalHeight;

    if (!onTarget) {
      outcome = 'miss';     // el NPC erró: no cuenta como atajada
    } else if (this.dived && this.diveTarget) {
      const dt2 = this.diveTarget;
      // Ventana de timing (ampliada por Reflejos).
      const ideal = cross.t - SAVE.idealLeadTime;
      const timingErr = Math.abs(this.swipeAtT - ideal);
      const perfectW = SAVE.perfectWindow * (1 + 0.6 * reflexN);
      const goodW = SAVE.goodWindow * (1 + 0.6 * reflexN);

      // Alcance (ampliado por Estirada).
      const catchR = SAVE.baseCatch + dt2.ext * SAVE.reachCatchBonus * (1 + 0.4 * reachN);
      const dist = Math.hypot(dt2.handX - cross.x, dt2.handY - cross.y);

      if (timingErr <= perfectW && dist < catchR) outcome = 'save';
      else if (timingErr <= goodW && dist < catchR * 1.15) outcome = 'save_deflect';
      else outcome = 'goal';
    }
    this.result = { type: 'save', outcome, cross };
    this.phase = 'done';
    this.ctx.onResolve(this.result);
  }

  render() {
    const r = this.ctx.renderer, look = this.ctx.profile.look();
    r.clear();
    r.drawField(this.cam);
    r.drawShooterFigure(this.cam, '#3d8bff');   // NPC (BLUE) a lo lejos
    if (this.ball.alive || this.phase === 'done') r.drawBall(this.cam, this.ball, look.ballColor);
    r.drawGoalFrameOverlay();                     // marco sutil = estamos en el arco
    r.drawGloves(this.gloves);
  }
}
