# ⚽ Penal Clash — Prototipo v2

Juego de penales 1v1 **touch-first** para móvil. Pateás con un deslizamiento
sensible a **ángulo + fuerza + curva**, atajás desde el **POV del arco** con su
propia mecánica de skill, jugás al **mejor de 3** y subís de liga por trofeos.

> Diseño, decisiones y hoja de ruta: ver **[GAME_DESIGN.md](./GAME_DESIGN.md)**.

## Cómo correrlo

Es HTML/JS/Canvas sin build, pero usa **ES modules**, así que hay que servirlo
por HTTP (abrir el `index.html` con doble clic **no** funciona por CORS).

**Opción A — servidor local (para probar en la compu o en el cel por wifi):**
```bash
cd game
python3 -m http.server 8099
# En la compu:  http://localhost:8099
# En el cel (misma wifi):  http://<IP-de-tu-compu>:8099
```
Cualquier server estático sirve (`npx serve`, `http-server`, etc.).

**Opción B — GitHub Pages (lo más cómodo para que tu amigo lo pruebe en el cel):**
1. Settings → Pages → Deploy from branch → rama y carpeta `/root` (o `/docs`).
2. Entrá a `https://<usuario>.github.io/<repo>/game/`.

## Controles

- **Patear:** deslizá desde el balón hacia el arco. Dirección = puntería,
  largo/flick = fuerza, arco del trazo = comba. Gesto brusco = tiro desviado.
- **Atajar:** deslizá hacia el palo. La altura del trazo = altura de la
  estirada; el largo = extensión; el **timing** es lo que más importa.

## Mapa del código (`game/src/`)

```
config.js        Tuning + catálogos (cosméticos, stats, ligas). ← todo el contenido es DATO
core.js          EventBus · Storage (localStorage) · StateMachine
input.js         Captura y ANÁLISIS del swipe (ángulo/fuerza/curva/limpieza)
engine.js        Matemática 3D, proyección de cámara (POV swap) y física del balón (Magnus)
render.js        Dibujo en canvas: cancha, arco, arquero, guantes, balón — ambos POV
shoot.js         Controlador de TIRO (gesto → física + castigo FIFA + arquero NPC)
save.js          Controlador de ATAJADA (POV arco, mecánica de skill)
ai.js            NPC: arquero y pateador, por dificultad
match.js         Mejor de 3 (ABAB) + muerte súbita + trofeos
progression.js   Perfil: trofeos/ligas, stats con tope 3-de-5, cosméticos (roster-ready)
challenges.js    Retos offline (catálogo declarativo + runner)
ui.js            Pantallas DOM + HUD
main.js          Bootstrap: cablea todo y corre el game loop
```

La arquitectura está pensada para **enchufar** tienda de cosméticos, stats
ganadas jugando, roster multi-jugador o modo historia **sin reescribir el
core**. El detalle de cada hook está en `GAME_DESIGN.md` (sección 2).

## Estado

Prototipo funcional y verificado (menú, ambos POV, partido completo, retos,
cosméticos, tope de stats). Pensado para iterar, no es producción.
