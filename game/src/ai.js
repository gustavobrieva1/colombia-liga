// =============================================================================
// ai.js  —  Oponente NPC: arquero (cuando el jugador patea) y pateador (cuando
// el jugador ataja). Parametrizado por dificultad, así los retos offline y el
// VS contra la máquina reutilizan la misma lógica.
// =============================================================================
import { WORLD, SAVE } from './config.js';
import { velocityFrom, predictCross } from './engine.js';

const KEEPER_SIGMA = { easy: 2.4, normal: 1.5, hard: 0.95 }; // error de lectura (m)

// Ruido gaussiano simple (Box-Muller).
function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// El arquero NPC intenta atajar un tiro del jugador. Devuelve la posición de la
// mano/estirada con la que "adivina", y si cubre el punto de cruce.
export function keeperReadShot(cross, diff = 'normal') {
  const sigma = KEEPER_SIGMA[diff] ?? 1.5;
  if (!cross) return { handX: 0, handY: 1.0, catchR: 0, saved: false, dive: 0, ext: 0 };
  const handX = cross.x + gauss() * sigma;
  const handY = Math.max(0.2, cross.y + gauss() * sigma * 0.5);
  const catchR = SAVE.baseCatch + SAVE.reachCatchBonus * 0.7;
  const d = Math.hypot(handX - cross.x, handY - cross.y);
  const saved = d < catchR;
  const dive = Math.sign(handX) || 0;
  const ext = Math.min(1, Math.abs(handX) / SAVE.maxReachX + 0.3);
  return { handX: clampGoalX(handX), handY, catchR, saved, dive, ext };
}

// El pateador NPC dispara a una zona objetivo (con estilo según dificultad).
// Devuelve {vel, spin, targetCross} listo para lanzar el balón.
export function aiShot(diff = 'normal') {
  const hw = WORLD.goalWidth / 2;
  // Apunta a esquinas con más frecuencia en dificultad alta.
  const cornerBias = diff === 'hard' ? 0.85 : diff === 'normal' ? 0.6 : 0.35;
  const side = Math.random() < 0.5 ? -1 : 1;
  const tx = (Math.random() < cornerBias ? (0.55 + Math.random() * 0.35) : (Math.random() * 0.5)) * side * hw;
  const ty = (Math.random() < cornerBias ? (0.55 + Math.random() * 0.35) : (0.25 + Math.random() * 0.35)) * WORLD.goalHeight;

  // Resuelve una velocidad que aterrice cerca de (tx, ty) en z=goalZ.
  const speed = 20 + Math.random() * 6;
  const vz = speed * 0.99;
  const t = WORLD.goalZ / vz;
  const vx = tx / t;
  const vy = (ty - WORLD.ballRadius + 0.5 * WORLD.gravity * t * t) / t;
  const vel = { x: vx, y: vy, z: vz };
  const spin = (Math.random() - 0.5) * (diff === 'hard' ? 16 : 8);
  const targetCross = predictCross(vel, spin);
  return { vel, spin, targetCross };
}

function clampGoalX(x) {
  const lim = WORLD.goalWidth / 2 + 0.6;
  return Math.max(-lim, Math.min(lim, x));
}

// Reexport util para evitar import directo en gameplay.
export { velocityFrom };
