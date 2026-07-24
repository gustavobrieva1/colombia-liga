// =============================================================================
// core.js  —  Infraestructura desacoplada: bus de eventos, persistencia y
// máquina de estados. Los módulos de gameplay se comunican SÓLO por el bus,
// para poder enchufar/quitar features (cosméticos, stats, roster) sin acoplar.
// =============================================================================

export class EventBus {
  constructor() { this.map = new Map(); }
  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) { this.map.get(type)?.delete(fn); }
  emit(type, payload) {
    this.map.get(type)?.forEach(fn => {
      try { fn(payload); } catch (e) { console.error(`[bus:${type}]`, e); }
    });
  }
}

// Persistencia con un solo blob namespaced. Serializa el "perfil" del jugador:
// trofeos, stats, cosméticos, retos completados. Tolerante a esquemas viejos.
const KEY = 'penalclash.save.v1';

export const Storage = {
  load(defaults) {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(defaults);
      return deepMerge(structuredClone(defaults), JSON.parse(raw));
    } catch {
      return structuredClone(defaults);
    }
  },
  save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  },
  wipe() { try { localStorage.removeItem(KEY); } catch {} },
};

function deepMerge(base, over) {
  if (Array.isArray(over)) return over.slice();
  if (over && typeof over === 'object') {
    for (const k of Object.keys(over)) {
      base[k] = (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]))
        ? deepMerge(base[k], over[k]) : over[k];
    }
    return base;
  }
  return over === undefined ? base : over;
}

// Máquina de estados minimalista. Cada estado es un string; los módulos
// escuchan 'state:enter' / 'state:exit' por el bus.
export class StateMachine {
  constructor(bus) { this.bus = bus; this.state = null; }
  go(next, data = {}) {
    const prev = this.state;
    if (prev) this.bus.emit('state:exit', { state: prev, next });
    this.state = next;
    this.bus.emit('state:enter', { state: next, prev, data });
  }
  is(s) { return this.state === s; }
}

// Estados del juego.
export const S = {
  MENU: 'MENU',
  MATCH_INTRO: 'MATCH_INTRO',
  SHOOT: 'SHOOT',       // el jugador patea
  SAVE: 'SAVE',         // el jugador ataja (POV arquero)
  ROUND_RESULT: 'ROUND_RESULT',
  MATCH_RESULT: 'MATCH_RESULT',
  CHALLENGE: 'CHALLENGE',
};
