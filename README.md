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
| `src/map` | Dibujo del mapa |
| `src/i18n` | Textos de la interfaz |
| `data` | Números del juego (`balance.json`) |
| `tests` | Tests de reglas (`unit`) y de navegador (`e2e`) |

## Créditos

Mapas © OpenStreetMap contributors (a partir de la Fase 3).
