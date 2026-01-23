# Liga DIMAYOR 2026

CLI interactiva para explorar estadisticas de jugadores de la Liga Colombiana (Primera A, Apertura 2026). Los datos se obtienen de SofaScore.

## Instalacion

```bash
git clone https://github.com/gustavobrieva1/colombia-liga.git
cd colombia-liga
pip install -r requirements.txt
```

## Uso

```bash
python3 colombia.py           # Carga desde cache o scrapea si es la primera vez
python3 colombia.py --update  # Forzar actualizacion desde SofaScore
```

## Funcionalidades

### Equipos y Planteles
Navega por los 20 equipos de la liga. Ve el plantel completo (no solo los que han jugado) con rating, goles y asistencias.

### Rankings
Top 15 jugadores en 20 categorias:
- Goleadores, asistidores, mejor rating
- Pases clave, chances creadas, tiros al arco
- Tackles, intercepciones, despejes
- Duelos terrestres/aereos, regates
- Atajadas, vallas invictas (GK)
- Faltas, tarjetas, veces derribado

### Comparar Jugadores
Selecciona dos jugadores y ve sus stats lado a lado con indicador del mejor en cada categoria.

### Analisis Tactico
Rankings por equipo en cada stat:
- Que equipo hace mas pases precisos, mas tackles, mas despejes
- Que equipo comete mas faltas, recibe mas tarjetas
- Top contribuidor individual por equipo

### Analisis de Liga
- **Mejor XI** (4-3-3 por rating)
- **xG vs Goles Reales** - Eficiencia goleadora por equipo
- **Tabla de Disciplina** - Amarillas, rojas, faltas por equipo
- **Ranking por Posicion** - Top GK/DEF/MID/FWD con stats relevantes

### Buscar / Filtrar
- Buscar jugador por nombre
- Filtros predefinidos (delanteros goleadores, mediocampistas creativos, defensas solidos, jovenes)
- Filtro personalizado (posicion + criterio de orden)

## Navegacion

- Flechas arriba/abajo para moverse
- Enter para seleccionar
- `<- Back` para volver al menu anterior

## Requisitos

- Python 3.8+
- `tls-client`
- `simple-term-menu`
