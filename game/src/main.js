// =============================================================================
// main.js  —  Bootstrap: crea la infraestructura, cablea los módulos y corre el
// game loop (requestAnimationFrame). El objeto `game` es el coordinador que la
// UI usa para lanzar partidos y retos. Todo lo demás se comunica por el bus.
// =============================================================================
import { EventBus, Storage, StateMachine } from './core.js';
import { DIFFICULTY } from './config.js';
import { Profile } from './progression.js';
import { Renderer } from './render.js';
import { SwipeInput } from './input.js';
import { Hud, UI } from './ui.js';
import { runMatch } from './match.js';
import { runChallenge } from './challenges.js';

const bus = new EventBus();
const canvas = document.getElementById('stage');
const renderer = new Renderer(canvas);
const input = new SwipeInput(canvas, bus);
const profile = new Profile(bus, Storage);
const hud = new Hud();
const sfx = makeSfx();

const game = {
  ctxBase: { bus, input, renderer, profile, difficulty: DIFFICULTY, hud },
  profile,          // acceso directo para la UI
  scene: null,
  ui: null,
  busy: false,
  setScene(ctrl) { this.scene = ctrl; },

  async playMatch() {
    if (this.busy) return; this.busy = true;
    this.ui.hide();
    try { const sum = await runMatch(this); this.scene = null; renderer.clear(); this.ui.matchResult(sum); }
    finally { this.busy = false; }
  },
  async playChallenge(ch) {
    if (this.busy) return; this.busy = true;
    this.ui.hide();
    try { const sum = await runChallenge(this, ch); this.scene = null; renderer.clear(); this.ui.challengeResult(sum); }
    finally { this.busy = false; }
  },
};
game.ui = new UI(game);

// SFX simples por WebAudio (juice). Se resume el contexto al primer toque.
bus.on('sfx', name => sfx.play(name));

// Loop.
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;                 // clamp anti-saltos
  if (game.scene) { game.scene.update(dt); game.scene.render(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Resize.
const onResize = () => renderer.resize();
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

// Arranque.
game.ui.menu();

// -------- WebAudio mínimo --------
function makeSfx() {
  let ctx = null;
  const ensure = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (ctx && ctx.state === 'suspended') ctx.resume(); };
  window.addEventListener('pointerdown', ensure, { once: false });
  const beep = (freq, dur, type = 'sine', vol = 0.12) => {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol; o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur);
  };
  return { play(name) {
    ensure();
    if (name === 'kick') { beep(180, 0.12, 'triangle', 0.18); beep(90, 0.16, 'sine', 0.12); }
    else if (name === 'dive') beep(320, 0.12, 'sawtooth', 0.08);
  } };
}

// Exponer para debug en consola.
window.__game = game;
