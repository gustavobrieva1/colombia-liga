// =============================================================================
// match.js  —  Orquesta una tanda "mejor de 3": el jugador PATEA y ATAJA en
// cada ronda (formato ABAB), muerte súbita si empatan, y liquidación de
// trofeos al final. Reutiliza Shoot/Save controllers como "escenas".
//
// Es async y lineal a propósito: leer run() cuenta el core loop de arriba a
// abajo. Un modo nuevo (torneo, liga) se arma componiendo estos mismos ladrillos.
// =============================================================================
import { MATCH } from './config.js';
import { ShootController } from './shoot.js';
import { SaveController } from './save.js';
import { matchTrophies } from './progression.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

// Corre un controlador como escena hasta que resuelve; devuelve su resultado.
function playScene(game, Ctrl, opts = {}) {
  return new Promise(resolve => {
    const ctrl = new Ctrl({
      ...game.ctxBase,
      onResolve: res => { ctrl.exit(); resolve(res); },
    });
    game.setScene(ctrl);
    ctrl.enter(opts);
  });
}

export async function runMatch(game) {
  const { hud, profile, bus } = game.ctxBase;
  let red = 0, blue = 0, goalsScored = 0, savesMade = 0;

  hud.showScoreboard(true);
  hud.score(0, 0, `Mejor de ${MATCH.rounds}`);
  await hud.toast('RED vs BLUE', 'Tanda de penales', 1100);

  const playRound = async (n, label) => {
    hud.score(red, blue, label);

    // --- El jugador patea (RED) ---
    const shot = await playScene(game, ShootController);
    if (shot.outcome === 'goal') { red++; goalsScored++; await hud.toast('¡GOOOL!', styleText(shot.style), 1000); }
    else if (shot.outcome === 'save') await hud.toast('¡ATAJADO!', 'el arquero adivinó', 1000);
    else await hud.toast('AFUERA', 'se fue desviado', 1000);
    hud.score(red, blue, label);
    await wait(250);

    // --- El jugador ataja (BLUE dispara) ---
    const save = await playScene(game, SaveController);
    if (save.outcome === 'save') { savesMade++; await hud.toast('¡GRAN ATAJADA!', '+skill', 1100); }
    else if (save.outcome === 'save_deflect') { savesMade++; await hud.toast('¡AL CÓRNER!', 'con la puntita', 1050); }
    else if (save.outcome === 'miss') await hud.toast('¡AL PALO!', 'BLUE la mandó afuera', 1000);
    else { blue++; await hud.toast('gol de BLUE', 'no llegaste', 1000); }
    hud.score(red, blue, label);
    await wait(250);
  };

  for (let n = 1; n <= MATCH.rounds; n++) await playRound(n, `Ronda ${n}/${MATCH.rounds}`);

  // Muerte súbita.
  let sd = 0;
  while (red === blue && sd < 5) { sd++; await hud.toast('MUERTE SÚBITA', `desempate ${sd}`, 1100); await playRound(MATCH.rounds + sd, `Muerte súbita ${sd}`); }

  const won = red > blue;
  const delta = matchTrophies({ goalsScored, savesMade, won });
  profile.addTrophies(delta);

  hud.showScoreboard(false);
  const summary = { red, blue, won, goalsScored, savesMade, delta,
    trophies: profile.trophies, league: profile.league() };
  bus.emit('match:result', summary);
  return summary;
}

function styleText(style) {
  if (!style || !style.length) return 'golazo';
  if (style.includes('panenka')) return '¡PANENKA!';
  if (style.includes('top_corner')) return 'al ángulo';
  if (style.includes('curled')) return 'con comba';
  return 'golazo';
}
