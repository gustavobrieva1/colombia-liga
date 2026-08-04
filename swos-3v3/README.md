# Prototipo 3 v 3 offline para OpenSWOS (Ruta A)

Parche sobre [angree/openswos](https://github.com/angree/openswos) que añade
un modo experimental **3 contra 3** (portero + 2 jugadores de campo por
equipo): un humano controlando su equipo al estilo clásico de SWOS (cambio
automático al jugador más cercano al balón) contra un equipo 100% IA — en
todo momento hay 1 jugador humano y 5 IA en cancha.

- `0001-Add-experimental-3-a-side-match-mode-route-A-prototy.patch` — el
  commit completo (5 archivos de código + doc `docs/3v3-PROTOTYPE.md`).

## Cómo funciona

En vez de redimensionar el motor (que asume 11 por equipo en su pool de
sprites y tablas), los 8 jugadores de campo sobrantes de cada equipo se
marcan al entrar al campo igual que un expulsado por roja (`sentAway = 1`,
`cards = -1`) y se aparcan fuera de la cancha. Todos los sistemas del motor
que ya excluyen expulsados (elección de jugador controlado, receptor de
pases, cobradores de balón parado, recolocación en pausas, barrera) los
ignoran sin tocar nada. Se parchearon 4 huecos del port (recolocación
táctica en juego abierto, re-elección de emergencia, renderer, banquillo),
todos condicionados al flag del modo: con el modo apagado el 11 v 11 queda
byte-idéntico al original.

## Cómo probarlo en tu máquina

Necesitas: **Godot 4.x (versión .NET)**, el **SDK de .NET**, y tu copia
original de **SWOS 96/97 de Amiga** (dos imágenes `.adf` — OpenSWOS no
distribuye assets).

```bash
# 1. Clona el proyecto original y aplica el parche
git clone https://github.com/angree/openswos
cd openswos
git am ruta/al/0001-Add-experimental-3-a-side-match-mode-route-A-prototy.patch

# 2. Abre game/project.godot con Godot 4 (.NET) y dale a ejecutar (F5)
#    En el primer arranque OpenSWOS crea la carpeta original_swos_adf/:
#    copia ahí tus dos .adf de SWOS 96/97 y reinicia.
```

En la pantalla de configuración del partido:

1. Baja el foco hasta la nueva ranura **`mode`** y cambia con ←/→ a
   `3 v 3 (experimental)`.
2. Deja `opponent : AI`, elige equipos y pulsa espacio para empezar.
3. Controlas al jugador más cercano al balón (cambio clásico de SWOS);
   tu portero y el equipo rival van con IA.

El toggle se lee al arrancar el partido; cambiarlo a mitad de partido no
hace nada hasta el siguiente.

## Limitaciones conocidas del prototipo

- Cancha de tamaño completo (reducirla es trabajo de la ruta B) — se siente
  espaciado.
- Sin sustituciones en 3 v 3 (banquillo desactivado).
- En las reanudaciones los 2 jugadores de campo usan las filas 0-1 de la
  táctica elegida (se alinean como lateral y central derechos).
- Defendiendo un tiro libre, ambos jugadores de campo van a la barrera.
- Tanda de penaltis sin probar en este modo.
