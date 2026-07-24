// =============================================================================
// engine.js  —  Matemática 3D mínima, proyección de cámara (POV intercambiable)
// y física del balón (gravedad + efecto Magnus para la curva).
// Mundo en metros. Ejes: x lateral (+der), y altura (+arriba), z profundidad
// (+hacia el arco). El punto penal está en z=0, el arco en z=WORLD.goalZ.
// =============================================================================
import { WORLD } from './config.js';

// Proyección perspectiva con cámara que puede mirar hacia +z o -z (POV swap).
// Devuelve {x, y, scale, depth, onScreen}. scale sirve para tamaños (radio,
// grosor) y depth para z-order. focalK escala con el tamaño del canvas.
export function project(p, cam, W, H) {
  const focal = cam.focal * Math.max(W, H);
  const depth = (p.z - cam.pos.z) * cam.dir; // >0 si está delante de la cámara
  if (depth <= 0.05) return { x: 0, y: 0, scale: 0, depth, onScreen: false };
  const sx = W / 2 + cam.dir * (p.x - cam.pos.x) * focal / depth;
  const sy = H * 0.5 - (p.y - cam.pos.y) * focal / depth;
  return { x: sx, y: sy, scale: focal / depth, depth, onScreen: true };
}

// ---------------------------------------------------------------------------
// Ball: integra la trayectoria. Se construye desde una velocidad inicial y un
// "spin" lateral (curva). Sabe decir cuándo/dónde cruza el plano del arco.
// ---------------------------------------------------------------------------
export class Ball {
  constructor() { this.reset(); }
  reset() {
    this.pos = { x: 0, y: WORLD.ballRadius, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.spin = 0;          // curva lateral (m/s^2)
    this.alive = false;
    this.t = 0;
    this.crossed = null;    // {x, y, t} al cruzar z=goalZ
    this.trail = [];
  }

  launch(vel, spin) {
    this.reset();
    this.vel = { ...vel };
    this.spin = spin;
    this.alive = true;
  }

  // Avanza dt segundos. Devuelve true mientras siga "viva".
  step(dt) {
    if (!this.alive) return false;
    this.t += dt;

    // Aceleración: gravedad + Magnus perpendicular a la velocidad horizontal.
    const vh = Math.hypot(this.vel.x, this.vel.z) || 1;
    // Normal horizontal (a la derecha del avance): rota (vx,vz) -90°.
    const nx = this.vel.z / vh, nz = -this.vel.x / vh;
    const ax = this.spin * nx;
    const az = this.spin * nz;

    this.vel.x += ax * dt;
    this.vel.z += az * dt;
    this.vel.y -= WORLD.gravity * dt;

    const prevZ = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    // Rastro para el efecto visual de la curva.
    this.trail.push({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    if (this.trail.length > 40) this.trail.shift();

    // Cruce del plano del arco (interpolado).
    if (this.crossed === null && prevZ < WORLD.goalZ && this.pos.z >= WORLD.goalZ) {
      const f = (WORLD.goalZ - prevZ) / (this.pos.z - prevZ || 1);
      this.crossed = {
        x: this.pos.x - this.vel.x * dt * (1 - f),
        y: this.pos.y - this.vel.y * dt * (1 - f),
        t: this.t,
      };
    }

    // Muere si pasó bien el arco, tocó el piso lejos, o se fue muy atrás/lejos.
    if (this.pos.z > WORLD.goalZ + 2) this.alive = false;
    if (this.pos.y <= 0 && this.vel.y < 0 && this.pos.z > WORLD.goalZ * 0.4) {
      this.pos.y = 0; this.alive = false;
    }
    return this.alive;
  }
}

// Construye la velocidad inicial del disparo a partir de parámetros de gesto.
// yawDeg: lateral (+der), pitchDeg: elevación, speed: m/s.
export function velocityFrom(yawDeg, pitchDeg, speed) {
  const yaw = yawDeg * Math.PI / 180;
  const pitch = pitchDeg * Math.PI / 180;
  return {
    x: speed * Math.cos(pitch) * Math.sin(yaw),
    y: speed * Math.sin(pitch),
    z: speed * Math.cos(pitch) * Math.cos(yaw),
  };
}

// Simula (sin renderizar) para saber dónde cruzará el arco. Lo usan la IA del
// arquero y el resolutor de atajadas para "leer" el tiro.
export function predictCross(vel, spin) {
  const b = new Ball();
  b.launch(vel, spin);
  let guard = 0;
  while (b.alive && b.crossed === null && guard < 2000) { b.step(1 / 120); guard++; }
  return b.crossed; // puede ser null si el tiro se fue por arriba/abajo antes
}
