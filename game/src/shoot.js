// =============================================================================
// shoot.js  —  Controlador de TIRO (jugador patea). Traduce el gesto a un
// disparo físico (ángulo + fuerza + curva), aplica el castigo tipo FIFA por
// gesto sucio, lanza el balón y resuelve gol/atajada/afuera con el arquero NPC.
// Expone la interfaz común: enter / update / render / exit.
// =============================================================================
import { SHOT, WORLD, CAMERAS } from './config.js';
import { Ball, velocityFrom } from './engine.js';
import { keeperReadShot } from './ai.js';
import { clamp } from './input.js';

export class ShootController {
  constructor(ctx) {
    this.ctx = ctx;                 // { bus, input, renderer, profile, difficulty, hud }
    this.cam = CAMERAS.shooter;
    this.ball = new Ball();
    this.subs = [];
  }

  enter(opts = {}) {
    this.opts = opts;               // {target?} para retos ("mete al palo derecho")
    this.phase = 'aim';             // aim -> flight -> done
    this.liveSamples = null;
    this.timeLeft = SHOT.timer.enabled ? SHOT.timer.seconds : Infinity;
    this.resolved = false;
    this.keeper = { x: 0, dive: 0, reach: 0, targetX: 0, targetY: 1.0, committed: false };
    this.result = null;

    const { bus, input, hud } = this.ctx;
    input.enable();
    hud.role('shoot', '¡A PATEAR!');
    hud.hint('Deslizá desde el balón hacia el arco. Curvá el trazo para comba. Un flick seco = más fuerza.');

    this.subs.push(bus.on('swipe:move', d => { if (this.phase === 'aim') this.liveSamples = d.samples; }));
    this.subs.push(bus.on('swipe', g => { if (this.phase === 'aim') this._shoot(g); }));
    this.subs.push(bus.on('swipe:cancel', () => { this.liveSamples = null; }));
  }

  exit() {
    this.subs.forEach(off => off()); this.subs = [];
    this.ctx.input.disable();
    this.ctx.hud.hint(null);
  }

  // ------- construir el disparo a partir del gesto + stats del jugador -------
  _shoot(g) {
    const p = this.ctx.profile;
    const powerStat = p.statN('power'), curveStat = p.statN('curve'), accStat = p.statN('accuracy');

    // Puntería lateral y elevación desde la dirección del trazo.
    const side = clamp(g.dirX / 0.32, -1, 1);
    const upness = clamp(-g.dirY / 0.45, 0, 1);
    let yaw = side * SHOT.maxYawDeg;
    let pitch = SHOT.minPitchDeg + upness * (SHOT.maxPitchDeg - SHOT.minPitchDeg);

    // Fuerza -> velocidad (mejorada por stat Potencia).
    let power = clamp(g.power, 0, 1.1);
    let speed = (SHOT.minSpeed + power * (SHOT.maxSpeed - SHOT.minSpeed)) * (0.9 + 0.2 * powerStat);

    // Curva -> spin (mejorado por stat Comba).
    const spin = g.curve * SHOT.curveAccel * (0.7 + 0.6 * curveStat);

    // Castigo tipo FIFA: gesto sucio => desviación. La stat Precisión lo mitiga.
    const sloppy = (1 - g.clean) * (1 - 0.55 * accStat);
    yaw += (Math.random() - 0.5) * 2 * SHOT.sloppyYawDeg * sloppy;
    pitch += (Math.random() - 0.5) * 2 * SHOT.sloppyPitchDeg * sloppy;

    // Tiro flojo: si la fuerza es muy baja, sale débil y cae.
    if (power < SHOT.weakThreshold) { speed *= 0.72; pitch = Math.max(2, pitch - 4); }

    const vel = velocityFrom(yaw, pitch, speed);
    this.ball.launch(vel, spin);
    this._meta = { power, spin, yaw, pitch, clean: g.clean };

    // El arquero NPC "lee" el tiro y se compromete a una estirada.
    this.phase = 'flight';
    this.liveSamples = null;
    this.ctx.input.disable();
    this.ctx.hud.hint(null);
    this.ctx.bus.emit('sfx', 'kick');
  }

  // Disparo forzado si se acaba el tiempo (nervios).
  _panic() {
    const g = { dirX: (Math.random() - 0.5) * 0.5, dirY: -0.2, power: 0.4, curve: 0, clean: 0.2 };
    this.ctx.hud.toast('¡SIN TIEMPO!', 'nervios');
    this._shoot(g);
  }

  update(dt) {
    if (this.phase === 'aim') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = Infinity; this._panic(); }
      return;
    }
    if (this.phase === 'flight') {
      // Compromiso del arquero: apenas puede leer el cruce, se estira.
      if (!this.opts.noKeeper && !this.keeper.committed && this.ball.t > 0.10) {
        const cross = this.ball.crossed || predictLite(this.ball);
        const read = keeperReadShot(cross, this.ctx.difficulty);
        this.keeper.targetX = read.handX; this.keeper.targetY = read.handY;
        this.keeper.dive = read.dive; this.keeper._read = read; this.keeper.committed = true;
      }
      // Anima al arquero hacia su objetivo.
      this.keeper.x += (this.keeper.targetX - this.keeper.x) * Math.min(1, dt * 9);
      this.keeper.reach += (( this.keeper._read?.ext || 0) - this.keeper.reach) * Math.min(1, dt * 9);

      this.ball.step(dt);
      if (!this.ball.alive || (this.ball.crossed && this.ball.t > this.ball.crossed.t + 0.15)) {
        this._resolve();
      }
    }
  }

  _resolve() {
    if (this.resolved) return; this.resolved = true;
    const cross = this.ball.crossed;
    const hw = WORLD.goalWidth / 2;
    let outcome, style = [];

    const onTarget = cross && Math.abs(cross.x) <= hw && cross.y >= 0 && cross.y <= WORLD.goalHeight;
    if (!onTarget) {
      outcome = 'miss';
    } else {
      const read = this.keeper._read;
      const covered = !this.opts.noKeeper && read && read.saved &&
        Math.hypot(read.handX - cross.x, read.handY - cross.y) < read.catchR;
      outcome = covered ? 'save' : 'goal';
      if (outcome === 'goal') {
        if (Math.abs(cross.x) > hw * 0.62 && cross.y > WORLD.goalHeight * 0.5) style.push('top_corner');
        if (Math.abs(this._meta.spin) > 10) style.push('curled');
        if (this._meta.power < 0.5 && Math.abs(cross.x) < 0.8) style.push('panenka');
      }
    }
    this.result = { type: 'shoot', outcome, cross, style, meta: this._meta };
    this.phase = 'done';
    this.ctx.onResolve(this.result);
  }

  render() {
    const r = this.ctx.renderer, look = this.ctx.profile.look();
    r.clear();
    r.drawField(this.cam);
    r.drawGoal(this.cam);
    if (this.opts.target) r.drawTargetZone(this.cam, this.opts.target);
    if (!this.opts.noKeeper)
      r.drawKeeperFigure(this.cam, { x: this.keeper.x, dive: this.keeper.dive, reach: this.keeper.reach }, '#2b3550');
    if (this.ball.alive || this.phase === 'done') r.drawBall(this.cam, this.ball, look.ballColor);
    if (this.phase === 'aim' && this.liveSamples) r.drawSwipeGuide(this.liveSamples);
    // Balón en reposo antes de patear.
    if (this.phase === 'aim' && !this.ball.alive) {
      this.ball.pos = { x: 0, y: WORLD.ballRadius, z: 0 };
      r.drawBall(this.cam, this.ball, look.ballColor);
    }
  }
}

// Predicción ligera del cruce usando el estado actual (para que el arquero
// reaccione aun antes de que el balón cruce).
function predictLite(ball) {
  const b = new Ball();
  b.launch(ball.vel, ball.spin);
  b.pos = { ...ball.pos }; b.t = ball.t;
  let guard = 0;
  while (b.alive && b.crossed === null && guard < 800) { b.step(1 / 120); guard++; }
  return b.crossed;
}
