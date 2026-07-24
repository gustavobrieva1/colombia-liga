# ⚽ Penal Clash — Prototipo v2

Juego de penales 1v1 **touch-first** para móvil. Pateás con un deslizamiento
sensible a **ángulo + fuerza + curva**, atajás desde el **POV del arco** con su
propia mecánica de skill, jugás al **mejor de 3** y subís de liga por trofeos.

> Diseño, decisiones y hoja de ruta: ver **[GAME_DESIGN.md](./GAME_DESIGN.md)**.

## Cómo probarlo

### ⭐ Opción A — un solo archivo, sin instalar nada (la más fácil)
Abrí **[`standalone.html`](./standalone.html)** con doble clic. Es el juego
entero (JS + CSS) en un solo archivo autocontenido: funciona desde el disco
(`file://`), sin servidor. Para que lo pruebe tu amigo, **mandale ese archivo
por WhatsApp/Drive** y que lo abra en el navegador del cel (en iPhone: guardar
en Archivos → abrir con Safari).

### Opción B — servidor local (para desarrollar sobre el código modular)
El `index.html` usa **ES modules**, así que necesita HTTP (doble clic **no**
funciona por CORS):
```bash
cd game
python3 -m http.server 8099
# En la compu:  http://localhost:8099
# En el cel (misma wifi):  http://<IP-de-tu-compu>:8099
```
Cualquier server estático sirve (`npx serve`, `http-server`, etc.).

### Opción C — GitHub Pages (link público para compartir)
1. Settings → Pages → Deploy from branch → elegí la rama y carpeta `/ (root)`.
2. Entrá a `https://<usuario>.github.io/<repo>/game/standalone.html`.

### Regenerar `standalone.html`
Se genera bundleando el código modular. Si cambiás algo en `src/`:
```bash
cd game
npx esbuild src/main.js --bundle --format=iife --minify --outfile=bundle.tmp.js
# luego inline bundle.tmp.js dentro de un HTML con el CSS (o pedímelo y lo regenero)
```
> El código "fuente de verdad" es `src/` + `index.html`. `standalone.html` es
> solo un empaquetado para compartir fácil.

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
