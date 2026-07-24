# Penal Clash — Diseño de la v2 (prototipo)

Documento de acompañamiento del prototipo jugable en `/game`. Resume **qué se
construyó**, **cómo está armada la arquitectura para crecer**, y una
**propuesta de resolución** para las diferencias de visión que quedaron
abiertas, con un MVP concreto y qué conviene validar primero con jugadores.

---

## 1. Qué se implementó (core loop acordado)

Todo lo "ya acordado" del brief está jugable:

| Pieza | Estado | Dónde |
|---|---|---|
| Tanda 1v1 RED vs BLUE, sin equipos reales | ✅ | `match.js` |
| Mejor de 3 (ABAB) + muerte súbita | ✅ | `match.js` |
| **Tiro por deslizamiento** sensible a **ángulo + fuerza + curva** | ✅ | `input.js` → `shoot.js` |
| Timing punitivo tipo FIFA (gesto sucio ⇒ tiro desviado/débil) | ✅ | `shoot.js` (`sloppy`, `weakThreshold`) |
| **Atajada con POV desde el arco** + mecánica propia de skill | ✅ | `save.js` |
| Balanceo de recompensas: **atajar vale más que anotar** | ✅ | `config.js REWARDS`, `progression.js` |
| Sistema de trofeos + ligas (hasta "Champions") | ✅ | `progression.js` |
| Retos offline vs NPC ("métela al palo derecho", "tápale a Alan") | ✅ | `challenges.js` |
| Personalización cosmética (uniforme, balón, peinado, pateo, festejo) | ✅ | `config.js COSMETICS`, `ui.js` |
| Progresión de stats con **tope 3-de-5** (estilo Clash) | ✅ | `progression.js`, `config.js STATS` |
| Touch-first, corre en móvil (HTML/JS/Canvas, sin build) | ✅ | todo |

### El "skill" del gesto (lo más importante)
`analyzeSwipe()` (en `input.js`) convierte el trazo del dedo en 4 señales
independientes de resolución, inspiradas en lanzar la pokébola de Pokémon GO:

- **Dirección** del trazo → puntería lateral (yaw) y altura (pitch).
- **Fuerza** = mezcla de *largo* del trazo y *flick de suelta* (velocidad en los
  últimos ~50 ms). Un flick seco pega más fuerte que un arrastre lento.
- **Curva** = desviación perpendicular firmada del trazo respecto de la cuerda
  (el "arco" que dibujás) → efecto Magnus real en la física (`engine.js`).
- **Limpieza** = qué tan suave fue el gesto. El temblor errático baja la
  limpieza y suma **error** al tiro (castigo tipo FIFA). Un arco suave, aunque
  muy curvo, **no** se penaliza.

### La atajada como skill (no un botón)
Desde el POV del arquero, el NPC dispara y el balón se agranda al acercarse. Te
lanzás con un swipe donde: la **dirección** elige el palo, la **altura** del
trazo la altura de la estirada, el **largo/flick** la extensión, y el
**instante** del gesto es el timing. Hay ventana perfecta (atajada limpia) y
ventana buena (la sacás con la puntita, al córner). Si no reaccionás, es gol.

---

## 2. Arquitectura: pensada para enchufar features sin reescribir el core

Principios:

- **Todo lo que es contenido es DATO, no código.** Cosméticos, stats, ligas,
  retos y cámaras viven en `config.js` (y `challenges.js`). Agregar un peinado,
  una stat o un reto = agregar una entrada. El motor no conoce el catálogo.
- **Módulos desacoplados por un `EventBus`** (`core.js`). Nadie llama a nadie
  directo: emiten/escuchan eventos (`match:result`, `sfx`, `swipe`, …). Se puede
  quitar o sumar un sistema (audio, analytics, animaciones) sin tocar el resto.
- **Controladores con interfaz común** (`enter/update/render/exit`). Tiro y
  atajada son "escenas" intercambiables. Un modo nuevo (torneo, liga, campaña)
  se arma **componiendo** estas escenas — mirá `runMatch()`: se lee de arriba a
  abajo.
- **El perfil ya es un roster.** `profile.characters` es una **lista**; hoy
  usamos `characters[0]`. El gameplay siempre pide "el personaje activo". Sumar
  multi-jugador es agregar entradas + una pantalla de selección, sin tocar la
  física.

### Cómo se enchufa cada cosa que quedó "para después"

| Feature futura | Hook que ya existe | Qué falta |
|---|---|---|
| **Tienda de cosméticos** (monetización) | `char().owned[slot]` ya modela posesión; `owns()`/`setCosmetic()` respetan lo que tenés | UI de tienda + pasarela; hoy el proto desbloquea todo |
| **Stats ganadas jugando** | `incStat()` con tope 3-de-5 ya funciona; el gameplay lee `statN()` | Otorgar puntos como recompensa (no venderlos) |
| **Roster multi-jugador** | `characters[]` + `activeChar` | Pantalla de selección + balance |
| **Modo historia / manager** | Match y retos son funciones async componibles + economía (`coins`, `trophies`) | Capa de meta-progresión (club, estadio, sponsors) que secuencia partidos |
| **PvP online** | El resultado del match ya es un objeto serializable; input/gesto son deterministas dado el estado | Transporte (netcode) o async "tomá tu tiro y te aviso" |
| **Animaciones/estilos de pateo (CR7, paradinha)** | `look().kickStyle` ya se resuelve por dato | Enganchar a la animación/feedback (no afecta balance) |

> Regla de oro que respeta el código: **los cosméticos nunca tocan el balance**
> (solo `look()`), y **las stats nunca se compran** (solo `incStat()` con tope).
> Eso mantiene el "cero pay-to-win" que ambos quieren, por diseño y no por
> promesa.

---

## 3. Resolución propuesta para las diferencias abiertas

La tensión de fondo es sana: **vos** querés profundidad (roster, historia,
marketplace); **tu amigo** querés foco y que el skill mande. La app móvil
premia el foco al principio y la profundidad después. Propuesta: **shippear la
versión de tu amigo como MVP** (es la que está construida) y dejar la
profundidad como *capas opcionales que se activan cuando los números lo pidan*.

### Debate 1 — Alcance del roster
- **MVP (ship ya):** 1 personaje que hace de pateador **y** arquero. El skill
  del gesto es lo que te hace bueno; las stats son un condimento con tope, no la
  diferencia. (Ya implementado.)
- **Hook a tu visión:** `characters[]` permite, en una fase 2, **poseer varios
  personajes que vos mismo desarrollás** (no comprás desarrollados). Eso da
  profundidad de roster **sin** pay-to-win.
- **Veredicto:** empezá con 1. Sumá roster solo si la retención pide "coleccionar/variar".

### Debate 2 — Modo historia
- **MVP:** el "ladder" ya existe (trofeos → ligas → Champions) + retos offline.
  Eso cubre el 80% de la sensación de progresión con el 20% del costo.
- **Hook a tu visión:** una **"Carrera" ligera** estilo New Star Soccer (sesiones
  cortas, subís de división, mejorás el club) es viable en móvil **si es liviana
  y por sesiones**, no un manager pesado. La arquitectura la soporta como
  secuencia de matches/retos + economía.
- **Veredicto:** tu amigo tiene razón para el **lanzamiento** (historia pesada no
  arranca bien en móvil). Vos tenés razón para la **retención a mediano plazo**.
  Validá el ladder primero; si retiene, subí a "Carrera liviana".

### Debate 3 — Marketplace de jugadores
- **Comprar jugadores desarrollados = pay-to-win.** Ambos lo rechazan. Cae.
- **Marketplace de cosméticos:** sí, única monetización. Ya modelado.
- **Compromiso opcional:** un "mercado" donde gastás **moneda ganada** (no
  dinero real) para *fichar y entrenar* personajes que **desarrollás vos**. Es
  progresión, no atajo pago.
- **Veredicto:** marketplace **solo cosmético** con dinero real; cualquier
  "fichaje" es con moneda in-game y desarrollo propio.

### Debate 4 — Control de tiro (y timer)
- **Deslizamiento para patear: confirmado.** Es la expresión de skill; un botón
  mataría el diferencial. (Atajar también es swipe, con su propia mecánica.)
- **Timer al patear:** dejarlo **ON pero generoso** (hoy 6 s, configurable en
  `SHOT.timer`). Agrega tensión sin frustrar. Es la variable #1 a A/B testear.
- **Veredicto:** swipe para todo; timer on por defecto, pero medible y apagable.

---

## 4. Qué validar primero con jugadores reales (orden sugerido)

1. **¿El swipe se siente hábil y justo?** ¿La gente aprende a colocar y comba
   en 5-10 tiros? Es el riesgo #1: si no "engancha el dedo", nada importa.
2. **¿Atajar es divertido y el balance de recompensas se siente bien?** Que
   perder haciendo atajadas igual sume (como en el prototipo) es contraintuitivo
   — hay que ver si **motiva** o **confunde**. Es tu principal diferencial.
3. **¿El timer suma o frustra?** A/B: sin timer / 6 s / 4 s.
4. **¿El tope 3-de-5 genera decisiones interesantes** o se siente arbitrario?
5. **¿Los cosméticos son deseables** (peinados/festejos "de figura")? Señal
   temprana de disposición a pagar, sin construir la tienda entera.

Métricas mínimas para responder: tiros hasta el primer "golazo al ángulo",
% de atajadas por partida, D1 retention, y una encuesta corta de 2 preguntas
(«¿el tiro se siente justo?», «¿taparías otra vez?»).

---

## 5. Cómo correrlo

Es HTML/JS puro (sin build), pero usa ES modules → **necesita servirse por
HTTP** (no abrir el archivo directo). Ver `game/README.md`. Lo más rápido para
que tu amigo lo pruebe en el celular es **GitHub Pages**.
