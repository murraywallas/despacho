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

## Carpetas

| Carpeta | Contenido |
| --- | --- |
| `src/game` | Lógica del juego (sin interfaz) |
| `src/store` | Estado del juego |
| `src/ui` | Componentes de la interfaz |
| `src/map` | Dibujo del mapa |
| `src/i18n` | Textos de la interfaz |
| `data` | Números del juego (`balance.json`) |
| `tests` | Tests de reglas (`unit`) y de navegador (`e2e`) |

## Créditos

Mapas © OpenStreetMap contributors (a partir de la Fase 3).
