// =============================================================================
// challenges.js  —  Desafíos OFFLINE contra NPCs por recompensas. Catálogo
// declarativo (DATOS) + un runner genérico. Agregar un reto = agregar una
// entrada; el core no cambia. Reutiliza Shoot/Save como escenas.
// =============================================================================
import { WORLD } from './config.js';
import { ShootController } from './shoot.js';
import { SaveController } from './save.js';

const wait = ms => new Promise(r => setTimeout(r, ms));
const hw = WORLD.goalWidth / 2, gh = WORLD.goalHeight;

// Predicados de zona para retos de puntería.
const ZONES = {
  right_post: { label: 'al palo DERECHO', test: c => c && c.x > hw * 0.5 && c.y < gh },
  left_post:  { label: 'al palo IZQUIERDO', test: c => c && c.x < -hw * 0.5 && c.y < gh },
  top_right:  { label: 'al ÁNGULO derecho', test: c => c && c.x > hw * 0.4 && c.y > gh * 0.5 },
  top:        { label: 'por ARRIBA (bajo el travesaño)', test: c => c && Math.abs(c.x) < hw && c.y > gh * 0.55 && c.y <= gh },
};

// Catálogo. type: 'shoot_target' | 'save_streak'.
export const CHALLENGES = [
  { id: 'ch_right3', type: 'shoot_target', zone: 'right_post', need: 3, tries: 5,
    name: 'Métela toda al palo derecho', reward: 60,
    blurb: 'Anotá 3 tiros al palo derecho en 5 intentos.' },
  { id: 'ch_top2', type: 'shoot_target', zone: 'top_right', need: 2, tries: 5,
    name: 'Al ángulo', reward: 80,
    blurb: 'Clavá 2 al ángulo superior derecho.' },
  { id: 'ch_stopalan', type: 'save_streak', need: 3, tries: 4,
    name: 'Tápale el penal a Alan', reward: 100,
    blurb: 'Atajá 3 penales de Alan (dificultad alta).', difficulty: 'hard' },
  { id: 'ch_wall', type: 'save_streak', need: 4, tries: 6,
    name: 'La muralla', reward: 120,
    blurb: 'Atajá 4 de 6 remates.' },
];

function playScene(game, Ctrl, opts, difficulty) {
  return new Promise(resolve => {
    const ctrl = new Ctrl({
      ...game.ctxBase,
      difficulty: difficulty || game.ctxBase.difficulty,
      onResolve: res => { ctrl.exit(); resolve(res); },
    });
    game.setScene(ctrl);
    ctrl.enter(opts);
  });
}

export async function runChallenge(game, ch) {
  const { hud, profile, bus } = game.ctxBase;
  hud.showScoreboard(true);
  let success = 0, done = 0;

  const zone = ch.zone ? ZONES[ch.zone] : null;

  for (let i = 0; i < ch.tries; i++) {
    hud.score(success, 0, `${ch.name} — ${success}/${ch.need}`);
    if (ch.type === 'shoot_target') {
      hud.toast(`Objetivo`, zone.label, 900);
      const res = await playScene(game, ShootController, { noKeeper: true, target: ch.zone }, ch.difficulty);
      const ok = zone.test(res.cross);
      if (ok) { success++; await hud.toast('¡ADENTRO!', zone.label, 900); }
      else await hud.toast('no cuenta', 'fallaste la zona', 900);
    } else { // save_streak
      const res = await playScene(game, SaveController, {}, ch.difficulty);
      if (res.outcome === 'save' || res.outcome === 'save_deflect') { success++; await hud.toast('¡ATAJADA!', `${success}/${ch.need}`, 900); }
      else if (res.outcome === 'miss') await hud.toast('erró el NPC', 'no suma', 900);
      else await hud.toast('gol', 'no llegaste', 900);
    }
    done++;
    await wait(200);
    if (success >= ch.need) break;
  }

  hud.showScoreboard(false);
  const won = success >= ch.need;
  let reward = 0;
  if (won) reward = profile.markChallenge(ch.id, ch.reward) ? ch.reward : 0;
  const summary = { challenge: ch, success, need: ch.need, won, reward, coins: profile.data.coins };
  bus.emit('challenge:result', summary);
  return summary;
}
