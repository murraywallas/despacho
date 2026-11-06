# Despacho — reglas del proyecto

Juego web de estrategia en tiempo real: el jugador es el operador de una central de delivery
en Copenhague. Recibe pedidos, elige repartidor y vehículo, y arma rutas para que la comida
llegue caliente y a tiempo. Inspirado en 112 Operator. Diseño completo: ver el GDD (link en README).

## Fase actual

**Fase 2 — Prototipo gris.** Mapa falso (grilla), sin datos reales de Copenhague todavía.
El objetivo es comprobar que el loop de despacho es divertido. No agregar mapa real, sonido
ni arte hasta que una tarea lo pida.

## Pilares (toda decisión debe reforzar al menos uno)

1. Triage bajo presión: siempre hay más pedidos que repartidores.
2. Cada vehículo es un trade-off: ninguno es el mejor en todo.
3. Copenhague real y reconocible (desde la Fase 3).
4. Un mundo que cambia: clima y eventos obligan a replanificar.

## Stack

- Vite + React 19 + TypeScript (modo `strict`)
- Zustand para el estado del juego
- Canvas 2D para el mapa del prototipo (MapLibre GL JS llega en la Fase 3)
- Vitest (reglas) + Playwright (juego en el navegador)
- Deploy: Vercel (preview por cada Pull Request)

## Comandos

- `npm install` — instalar dependencias
- `npm run dev` — correr el juego en local
- `npm run build` — build de producción (debe pasar sin errores)
- `npm run test` — tests de reglas (Vitest)
- `npm run test:e2e` — tests en el navegador (Playwright)
- `npm run lint` — revisar estilo (oxlint)

## Estructura

```
src/
  game/        lógica pura del juego, sin React (simulación, reglas, rutas)
  store/       estado global con Zustand
  ui/          componentes React (paneles, barra superior, pantallas)
  map/         dibujo del mapa
  i18n/        textos de la interfaz (es.json)
data/
  balance.json números del juego (exportados de la planilla de balance)
tests/
  unit/        Vitest
  e2e/         Playwright
```

## Reglas de código

- **Ningún número de juego en el código.** Velocidades, capacidades, plazos, costos y
  frecuencias salen de `data/balance.json`. Si falta un valor, agregalo ahí con un comentario
  en el Pull Request.
- La lógica del juego (`src/game/`) es pura y testeable: no importa React ni toca el DOM.
- El tiempo del juego avanza con un reloj propio (`tick(dt)`), nunca con `setTimeout` sueltos.
  Así funcionan la pausa, la velocidad 2x y los tests.
- Código, variables y nombres de archivo en inglés. Textos visibles en `src/i18n/es.json`.
- Componentes chicos; nada de archivos de más de ~300 líneas.

## Glosario (español → código)

| Juego | Código |
| --- | --- |
| Turno | `shift` |
| Pedido | `order` |
| Repartidor | `rider` |
| Vehículo | `vehicle` |
| Restaurante | `restaurant` |
| Cliente / destino | `customer` |
| Plazo de entrega | `deadline` |
| Temperatura de la comida | `heat` |
| Estrellas | `rating` |

## Recursos permitidos (solo gratuitos)

OpenStreetMap (atribución obligatoria), OpenFreeMap, MapLibre GL JS, ngraph.path,
Kenney (CC0), Lucide, Google Fonts, Howler.js. Cualquier otra librería o recurso:
preguntá en la tarea antes de usarlo. Nunca servicios pagos ni que pidan API key.
Nunca nombres ni logos de marcas reales (restaurantes, apps de delivery).

## Forma de trabajo

- Una tarea = una rama = un Pull Request chico. Rama: `tarea/<número>-<descripcion-corta>`.
- Nunca hagas push ni merge a `main`. El merge lo hace Germán después de probar el preview.
- Si la tarea es ambigua, comentá la duda en la tarea y esperá. No adivines.
- No hagas cambios fuera del alcance de la tarea; anotá ideas como comentario.
- En el Pull Request explicá: qué cambió, cómo probarlo en el preview y qué quedó pendiente.

## Listo cuando (para toda tarea)

- Se cumplen todos los "Listo cuando" de la tarea.
- `npm run build`, `npm run test` y `npm run test:e2e` pasan.
- Hay tests para la lógica nueva de `src/game/`.
- No hay errores en la consola del navegador.
- La pantalla funciona a 1440 px y 1024 px de ancho.
