// =============================================================================
// input.js  —  Captura y ANÁLISIS del gesto de swipe (touch-first, pointer
// events sirven para touch y mouse). Convierte el trazo en una descripción
// abstracta: dirección, fuerza, curva y "limpieza". Esa descripción es lo que
// consume el gameplay; el resto del juego no sabe nada de píxeles ni de dedos.
//
// La referencia de feel es lanzar la pokébola en Pokémon GO: importa el flick
// (la velocidad de suelta), la dirección y el arco (curva) del trazo.
// =============================================================================

export class SwipeInput {
  constructor(canvas, bus) {
    this.canvas = canvas;
    this.bus = bus;
    this.active = false;
    this.samples = [];   // {x, y, t}
    this.enabled = false;

    // Un solo handler set; se activa/desactiva por estado.
    canvas.addEventListener('pointerdown', this._down = e => this._onDown(e), { passive: false });
    canvas.addEventListener('pointermove', this._move = e => this._onMove(e), { passive: false });
    window.addEventListener('pointerup',   this._up   = e => this._onUp(e),   { passive: false });
    window.addEventListener('pointercancel', this._up);
  }

  enable()  { this.enabled = true;  this.active = false; this.samples = []; }
  disable() { this.enabled = false; this.active = false; this.samples = []; this.bus.emit('swipe:end', null); }

  _pt(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  }

  _onDown(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.active = true;
    this.samples = [this._pt(e)];
    this.bus.emit('swipe:start', this.samples[0]);
  }
  _onMove(e) {
    if (!this.enabled || !this.active) return;
    e.preventDefault();
    const p = this._pt(e);
    this.samples.push(p);
    // Trazo en vivo para dibujar la "guía" del tiro.
    this.bus.emit('swipe:move', { samples: this.samples, last: p });
  }
  _onUp(e) {
    if (!this.enabled || !this.active) return;
    this.active = false;
    if (this.samples.length >= 2) {
      const g = analyzeSwipe(this.samples, this.canvas.width, this.canvas.height);
      this.bus.emit('swipe', g);
    } else {
      this.bus.emit('swipe:cancel', null);
    }
    this.samples = [];
  }
}

// ---------------------------------------------------------------------------
// analyzeSwipe: núcleo del "skill". Devuelve valores normalizados e
// independientes de resolución.
//   dirX/dirY : dirección global del trazo (-1..1 aprox, y negativo = hacia arriba)
//   power     : 0..1.1  (combina largo y flick de suelta)
//   curve     : -1..1   (arco del trazo; + hacia la derecha)
//   clean     : 0..1    (qué tan suave/controlado fue; jitter lo baja)
//   flick     : velocidad de suelta normalizada (feedback)
// ---------------------------------------------------------------------------
export function analyzeSwipe(samples, W, H) {
  const a = samples[0], b = samples[samples.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const minDim = Math.min(W, H);

  // Dirección normalizada.
  const dirX = dx / minDim;
  const dirY = dy / minDim;

  // Flick de suelta: velocidad de los últimos ~50 ms.
  let flick = 0;
  {
    const tEnd = b.t;
    let i = samples.length - 1;
    while (i > 0 && tEnd - samples[i].t < 50) i--;
    const s0 = samples[i];
    const d = Math.hypot(b.x - s0.x, b.y - s0.y);
    const dt = Math.max(1, b.t - s0.t);
    flick = (d / dt) / (minDim / 1000); // px/ms normalizado por tamaño
  }

  // Fuerza: mezcla de largo del trazo y flick de suelta.
  const lenFrac = len / minDim;
  const power = clamp(lenFrac * 1.7 * 0.55 + flick * 0.9 * 0.55, 0, 1.1);

  // Curva: desviación perpendicular firmada del trazo respecto de la cuerda.
  // Se toma el pico de desviación (positivo = el trazo se arquea a la derecha).
  let peak = 0;
  const nx = -dy / len, ny = dx / len; // normal a la cuerda
  for (const s of samples) {
    const proj = (s.x - a.x) * nx + (s.y - a.y) * ny;
    if (Math.abs(proj) > Math.abs(peak)) peak = proj;
  }
  const curve = clamp(peak / (len * 0.5), -1, 1);

  // Limpieza: penaliza cambios bruscos de dirección (jitter). Un arco suave
  // (aunque sea muy curvo) NO se penaliza; sólo el temblor errático.
  let jitter = 0, segs = 0;
  for (let i = 2; i < samples.length; i++) {
    const p0 = samples[i - 2], p1 = samples[i - 1], p2 = samples[i];
    const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    jitter += d; segs++;
  }
  const avgTurn = segs ? jitter / segs : 0;
  const clean = clamp(1 - (avgTurn - 0.18) / 0.9, 0, 1); // ~0.18 rad tolerado

  return { dirX, dirY, power, curve, clean, flick, len: lenFrac,
           start: a, end: b };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
