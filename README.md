# Despacho

Juego web de estrategia en tiempo real: sos el operador de una central de delivery en
Copenhague. Recibís pedidos, elegís repartidor y vehículo, y armás rutas para que la comida
llegue caliente y a tiempo.

- **Diseño del juego (GDD) y plan de desarrollo:** https://claude.ai/artifact/JL6dLW2Qt4wmEmNhyNHAwe
- **Reglas para los agentes y el código:** [`CLAUDE.md`](./CLAUDE.md)
- **Juego publicado:** _(pegar acá el link de Vercel)_

## Cómo correrlo en tu computadora

Necesitás [Node.js](https://nodejs.org) versión 20 o más nueva.

1. Abrí una terminal en la carpeta del proyecto.
2. Instalá las dependencias (solo la primera vez):
   ```
   npm install
   ```
3. Arrancá el juego:
   ```
   npm run dev
   ```
4. Abrí en el navegador el link que aparece (algo como `http://localhost:5173`).

## Otros comandos

| Comando | Qué hace |
| --- | --- |
| `npm run build` | Arma la versión final para publicar (carpeta `dist`) |
| `npm run preview` | Muestra esa versión final en local |
| `npm run lint` | Revisa el estilo del código |
| `npm run test` | Corre los tests de reglas (Vitest, carpeta `tests/unit`) |
| `npm run test:e2e` | Abre el juego en Chromium a 1440 px y 1024 px de ancho y corre los tests de navegador (Playwright, carpeta `tests/e2e`) |

La primera vez que uses `npm run test:e2e`, instalá el navegador que usa Playwright:

```
npx playwright install chromium
```

## Números del juego (balance)

Los números del juego viven en la
[planilla de balance](https://docs.google.com/spreadsheets/d/1ZPT-ptHHiV7kb4wClP_K82nu-DZU7dMXFIwtwAohwHs/edit)
y el juego los lee de `data/balance.json`. Nunca edites ese archivo a mano: cambiá la planilla y corré

```
npm run balance
```

El comando baja las pestañas Reglas, Vehículos, Barrios, Eventos y Niveles y vuelve a escribir `data/balance.json`.
Si algo de la planilla está mal (un ID repetido, una clave que choca con otra, un barrio con un vehículo
que no existe), avisa qué pestaña y qué fila revisar, y no cambia el archivo. La planilla tiene que estar
compartida como "Cualquier persona con el enlace: Lector". La pestaña Léeme explica cómo está armada.

## Calles (OpenStreetMap)

Las calles de cada barrio salen de OpenStreetMap y el juego las lee de `data/streets/<barrio>.json`.
Para volver a bajarlas (por ejemplo, después de cambiar el área en `scripts/streets/config.json`):

```
npm run streets
```

El comando pide las calles del área a la API pública de Overpass (sin registro) y arma el grafo:
cruces, tramos con su largo en metros, tipo de calle, manos únicas y ciclovías. Si el servidor está
ocupado, probá de nuevo en unos minutos.

## Cómo se le pasa una tarea al agente

1. Escribí la tarea como Issue con la plantilla "Tarea" (Qué · Por qué · Listo cuando · Fuera de alcance · Depende de).
2. Ponele la etiqueta `listo-para-dev`. El agente desarrollador la implementa, abre un Pull Request y
   el agente tester lo revisa. Si el tester encuentra fallas, el desarrollador corrige (hasta 3 rondas).
3. Probá el preview de Vercel que aparece en el Pull Request. Si querés cambios, comentá `@claude` con
   lo que hay que cambiar. Si está bien, hacé el merge.

Si el desarrollador tiene una duda, la deja como comentario en la tarea y saca la etiqueta: respondé y
volvé a ponerla. Los agentes están en `.claude/agents/` y los workflows en `.github/workflows/`.

## Carpetas

| Carpeta | Contenido |
| --- | --- |
| `src/game` | Lógica del juego (sin interfaz) |
| `src/store` | Estado del juego |
| `src/ui` | Componentes de la interfaz |
| `src/styles` | Estilos globales: tokens de diseño (colores, tipografía, medidas, capas), base y pantalla de turno |
| `src/map` | Dibujo del mapa |
| `src/audio` | Sonidos: qué suena en cada evento y el ambiente de fondo |
| `src/i18n` | Textos de la interfaz |
| `public/sounds` | Archivos de sonido |
| `data` | Números del juego (`balance.json`) y calles de cada barrio (`streets/`) |
| `.claude/skills/game-ui` | Reglas de diseño de la interfaz que sigue Claude Code |
| `tests` | Tests de reglas (`unit`) y de navegador (`e2e`) |

## Créditos

Calles y mapas © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), bajo licencia ODbL.

Sonidos de [Kenney](https://kenney.nl) (licencia [CC0](https://creativecommons.org/publicdomain/zero/1.0/)):

| Archivo | Original | Pack |
| --- | --- | --- |
| `new-order.ogg` | `bong_001.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) |
| `dispatch.ogg` | `drop_002.ogg` | Interface Sounds |
| `delivered.ogg` | `confirmation_002.ogg` | Interface Sounds |
| `urgent.ogg` | `tick_002.ogg` | Interface Sounds |
| `late.ogg` | `error_004.ogg` | Interface Sounds |
| `cancelled.ogg` | `error_008.ogg` | Interface Sounds |
| `shift-end.ogg` | `jingles_SAX02.ogg` | [Music Jingles](https://kenney.nl/assets/music-jingles) |

El ambiente de fondo (un murmullo grave de ciudad) se genera en el navegador, sin archivo.

Tipografías [Inter](https://fonts.google.com/specimen/Inter) y [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono), de Google Fonts (licencia OFL).
