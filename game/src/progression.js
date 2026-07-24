// =============================================================================
// progression.js  —  Perfil del jugador: trofeos/ligas, stats con tope 3-de-5
// y loadout de cosméticos. Es la capa que MONETIZA (cosméticos) y da METAS
// (stats/ligas) sin tocar el core del gameplay. Todo se guarda en Storage.
//
// Diseño clave para el debate abierto: el "perfil" ya está modelado como una
// LISTA de personajes (roster). Hoy usamos uno solo (index 0). Si mañana se
// decide roster multi-jugador o marketplace, se agregan entradas SIN reescribir
// nada: el gameplay siempre pide "el personaje activo".
// =============================================================================
import { STATS, COSMETICS, DEFAULT_LOADOUT, LEAGUES, REWARDS } from './config.js';

const FRESH = {
  trophies: 0,
  coins: 250,                 // moneda blanda (retos). Los cosméticos premium irían aparte.
  characters: [               // ← roster listo para crecer; hoy 1 activo.
    { id: 'me', name: 'Tú', loadout: { ...DEFAULT_LOADOUT }, stats: zeroStats(), owned: allOwned() },
  ],
  activeChar: 0,
  challengesDone: {},
  seenTutorial: false,
};

function zeroStats() {
  const s = {}; for (const d of STATS.defs) s[d.key] = 2; return s; // arranque bajo
}
// El prototipo desbloquea todos los cosméticos (la tienda real se enchufa aquí).
function allOwned() {
  const o = {};
  for (const slot of Object.keys(COSMETICS)) o[slot] = COSMETICS[slot].map(c => c.id);
  return o;
}

export class Profile {
  constructor(bus, storage) {
    this.bus = bus; this.storage = storage;
    this.data = storage.load(FRESH);
  }
  save() { this.storage.save(this.data); this.bus.emit('profile:changed', this.data); }

  char() { return this.data.characters[this.data.activeChar]; }

  // --- Trofeos / ligas ---
  get trophies() { return this.data.trophies; }
  addTrophies(n) {
    this.data.trophies = Math.max(0, this.data.trophies + n);
    this.save();
    return n;
  }
  league() {
    const t = this.data.trophies;
    let cur = LEAGUES[0];
    for (const l of LEAGUES) if (t >= l.min) cur = l;
    return cur;
  }
  nextLeague() {
    const t = this.data.trophies;
    return LEAGUES.find(l => l.min > t) || null;
  }

  // --- Stats con tope 3-de-5 (estilo Clash) ---
  maxedCount(stats = this.char().stats) {
    return STATS.defs.filter(d => stats[d.key] >= STATS.maxPerStat).length;
  }
  canIncrement(key) {
    const s = this.char().stats;
    if (s[key] >= STATS.maxPerStat) return false;
    // Si subir esta al máximo rompería el tope de 3 maximizadas, se bloquea.
    if (s[key] + 1 >= STATS.maxPerStat && this.maxedCount() >= STATS.maxedCap) return false;
    return true;
  }
  incStat(key) {
    if (!this.canIncrement(key)) return false;
    this.char().stats[key]++;
    this.save();
    return true;
  }
  decStat(key) {
    const s = this.char().stats;
    if (s[key] <= 0) return false;
    s[key]--; this.save(); return true;
  }
  // Normaliza una stat a 0..1 para que el gameplay la consuma.
  statN(key) { return (this.char().stats[key] || 0) / STATS.maxPerStat; }

  // --- Cosméticos ---
  loadout() { return this.char().loadout; }
  setCosmetic(slot, id) {
    if (!this.char().owned[slot]?.includes(id)) return false;
    this.char().loadout[slot] = id; this.save(); return true;
  }
  owns(slot, id) { return this.char().owned[slot]?.includes(id); }

  // Resuelve el loadout a colores/ids concretos que el renderer entiende.
  look() {
    const lo = this.char().loadout;
    const find = (slot, id) => COSMETICS[slot].find(c => c.id === id) || COSMETICS[slot][0];
    return {
      kitColor: find('kit', lo.kit).color,
      ballColor: find('ball', lo.ball).color,
      hair: lo.hair,
      kickStyle: lo.kickStyle,
      celebration: find('celebration', lo.celebration).id,
    };
  }

  // --- Retos offline ---
  markChallenge(id, reward) {
    if (this.data.challengesDone[id]) return false;
    this.data.challengesDone[id] = true;
    this.data.coins += reward || 0;
    this.save();
    return true;
  }
  challengeDone(id) { return !!this.data.challengesDone[id]; }
}

// Calcula el resultado de trofeos de un partido. Refleja la decisión de diseño:
// las ATAJADAS pesan más que los goles.
export function matchTrophies({ goalsScored, savesMade, won }) {
  let t = goalsScored * REWARDS.goalTrophies + savesMade * REWARDS.saveTrophies;
  t += won ? REWARDS.winBonus : REWARDS.lossPenalty;
  return t;
}
