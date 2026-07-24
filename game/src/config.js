// =============================================================================
// config.js  —  Fuente única de verdad para tuning y datos.
// Este archivo es el principal "seam" de extensibilidad: cosméticos, stats y
// (a futuro) roster / modo historia se declaran como DATOS aquí, no como código
// disperso. Agregar contenido = agregar entradas, sin tocar el core.
// =============================================================================

export const WORLD = {
  // Medidas reales de un arco de fútbol (metros).
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalZ: 11,          // distancia del punto penal al arco
  ballRadius: 0.11,
  gravity: 9.8,
};

// Cámaras para cada POV. dir=+1 mira hacia el arco (+z); dir=-1 mira al campo.
export const CAMERAS = {
  // Pateador: detrás del balón, encuadra el arco completo (postes visibles).
  shooter: { pos: { x: 0, y: 1.5, z: -4.3 }, dir: +1, focal: 0.82 },
  // Arquero: justo delante de la línea mirando al campo. El arco queda detrás
  // de la cámara (se dibuja un marco sutil en pantalla, no el arco entero).
  keeper:  { pos: { x: 0, y: 1.55, z: 10.4 }, dir: -1, focal: 0.9 },
};

// ---------------------------------------------------------------------------
// TIRO — cómo el gesto (ángulo + fuerza + curva) se traduce a física.
// ---------------------------------------------------------------------------
export const SHOT = {
  maxYawDeg: 24,          // apertura lateral máxima de puntería
  minPitchDeg: 4,
  maxPitchDeg: 21,
  minSpeed: 17,           // m/s con fuerza mínima
  maxSpeed: 31,           // m/s con fuerza máxima
  curveAccel: 26,         // m/s^2 de efecto Magnus a curva máxima
  // Referencias del swipe (fracción de la dimensión de pantalla).
  refLenFrac: 0.42,       // largo de swipe que da fuerza plena
  refFlick: 2.6,          // velocidad de "flick" (px/ms sobre alto) que satura
  // Castigo tipo FIFA por mala ejecución del gesto:
  sloppyYawDeg: 10,       // error lateral máx cuando el gesto es sucio
  sloppyPitchDeg: 7,
  weakThreshold: 0.34,    // fuerza < esto => tiro flojo (llega débil / se queda)
  // Timer opcional al patear (pregunta abierta #4). Ver GAME_DESIGN.md.
  timer: { enabled: true, seconds: 6.0 },
};

// ---------------------------------------------------------------------------
// ATAJADA — mecánica propia de skill desde el POV del arquero.
// ---------------------------------------------------------------------------
export const SAVE = {
  flightSeconds: { easy: 1.15, normal: 0.95, hard: 0.82 }, // tiempo para reaccionar
  maxReachX: 4.2,         // alcance lateral del buzo a extensión plena (m)
  maxReachY: 2.5,
  baseCatch: 0.75,        // radio de atrape base (m)
  reachCatchBonus: 0.95,  // radio extra a extensión plena
  perfectWindow: 0.12,    // s alrededor del instante ideal => atajada limpia
  goodWindow: 0.26,       // dentro de esto => llega con la punta (desvía)
  idealLeadTime: 0.30,    // hay que lanzarse ~0.30 s antes de que cruce
};

// ---------------------------------------------------------------------------
// RECOMPENSAS — se premia MÁS atajar que anotar (decisión de diseño).
// ---------------------------------------------------------------------------
export const REWARDS = {
  goalTrophies: 6,        // anotar un penal
  saveTrophies: 11,       // ¡atajar vale casi el doble!
  winBonus: 14,
  lossPenalty: -9,
  styleGoal: { top_corner: 8, curled: 6, panenka: 12 }, // bonus por estilo
};

export const MATCH = {
  rounds: 3,              // "mejor de 3": 3 tiros por lado, ABAB, muerte súbita si empatan
};

// ---------------------------------------------------------------------------
// STATS — sistema con tope 3-de-5 (estilo Clash). DATOS: el core sólo lee esto.
// Se ganan jugando (no se compran => cero pay-to-win). Afectan el gameplay de
// forma sutil. La lógica del tope vive en progression.js.
// ---------------------------------------------------------------------------
export const STATS = {
  maxPerStat: 10,
  maxedCap: 3,            // sólo podés llevar 3 de las 5 al máximo
  defs: [
    { key: 'power',    name: 'Potencia',  desc: 'Más velocidad de disparo.' },
    { key: 'curve',    name: 'Comba',     desc: 'Más efecto/curva en el balón.' },
    { key: 'accuracy', name: 'Precisión', desc: 'Menos error por gesto sucio.' },
    { key: 'reflex',   name: 'Reflejos',  desc: 'Ventana de atajada más amplia.' },
    { key: 'reach',    name: 'Estirada',  desc: 'Mayor alcance del arquero.' },
  ],
};

// ---------------------------------------------------------------------------
// COSMÉTICOS — única vía de monetización. DATOS puros: agregar item = agregar
// entrada. El renderer consume estos ids sin conocer el catálogo.
// (owned/price se usan por la tienda a futuro; el prototipo desbloquea todo.)
// ---------------------------------------------------------------------------
export const COSMETICS = {
  kit: [
    { id: 'kit_red',   name: 'Furia Roja', color: '#ff4d5e' },
    { id: 'kit_navy',  name: 'Marino',     color: '#3d8bff' },
    { id: 'kit_lime',  name: 'Neón',       color: '#c6ff4d' },
    { id: 'kit_purple',name: 'Púrpura',    color: '#b06dff' },
    { id: 'kit_black', name: 'Pantera',    color: '#2b3550' },
  ],
  hair: [
    { id: 'hair_short', name: 'Clásico' },
    { id: 'hair_mohawk',name: 'Cucurella' }, // guiño
    { id: 'hair_buzz',  name: 'Haaland' },
    { id: 'hair_afro',  name: 'Afro' },
  ],
  ball: [
    { id: 'ball_white', name: 'Clásica', color: '#ffffff' },
    { id: 'ball_gold',  name: 'Dorada',  color: '#ffcf5c' },
    { id: 'ball_fire',  name: 'Fuego',   color: '#ff7a3d' },
  ],
  // Estilo de pateo / celebración: hooks declarativos (afectan feedback, no balance).
  kickStyle: [
    { id: 'kick_normal', name: 'Normal' },
    { id: 'kick_cr7',    name: 'CR7 (potente)' },
    { id: 'kick_paradinha', name: 'Paradinha' },
  ],
  celebration: [
    { id: 'cel_none', name: 'Ninguna' },
    { id: 'cel_siu',  name: 'SIUU' },
    { id: 'cel_calm', name: 'Tranquilo' },
  ],
};

// Loadout por defecto (lo que trae una cuenta nueva).
export const DEFAULT_LOADOUT = {
  kit: 'kit_red', hair: 'hair_short', ball: 'ball_white',
  kickStyle: 'kick_normal', celebration: 'cel_siu',
};

// ---------------------------------------------------------------------------
// LIGAS / RANGOS — trofeos básicos con salto a "Champions" al tope.
// ---------------------------------------------------------------------------
export const LEAGUES = [
  { min: 0,   name: 'Barrio',    icon: '🥉' },
  { min: 120, name: 'Ascenso',   icon: '🥈' },
  { min: 300, name: 'Primera',   icon: '🥇' },
  { min: 600, name: 'Elite',     icon: '💎' },
  { min: 1000,name: 'Champions', icon: '🏆' }, // liga tope: sólo trofeos
];

export const DIFFICULTY = 'normal'; // easy | normal | hard  (para retos/AI)
