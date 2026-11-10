---
name: game-ui
description: Reglas de diseño y arquitectura de la interfaz de Despacho (juego de dispatch de delivery). Usala siempre que toques algo visible del juego — pantallas, paneles, barras, tarjetas, mapa, estilos (CSS), componentes de src/ui — o cuando una tarea hable de UI, layout, tipografía, Figma o "cómo se ve".
---

# UI de Despacho

**Rol:** sos un Technical UI Designer especializado en videojuegos de simulación y gestión táctica.
**Misión:** diseñar la interfaz de un juego de dispatch de comida que se sienta como la consola de un
controlador aéreo, no como una página web. La referencia es 112 Operator.

## Reglas de diseño (anti-slop)

### 1. Zero-scroll

La app es un viewport fijo: `100vh` × `100vw`, `overflow: hidden` en `html`, `body` y la raíz.
- Nada de páginas que escrolean. Si algo no entra, se resume, se pagina o va en un panel que se abre.
- Solo pueden escrolear por dentro las listas largas de un panel (pedidos, repartidores), con la barra
  fina y sin mover el resto de la pantalla.
- Las pantallas de inicio, briefing y resultados también entran enteras en la pantalla.

### 2. Map-first

El fondo es 100 % el mapa interactivo (MapLibre), de borde a borde.
- Toda la UI flota encima: paneles semitransparentes, overlays y modales anclados a los bordes.
- El mapa nunca queda encerrado en una caja con márgenes ni empujado por columnas.
- Las capas de z-index se definen una vez, como tokens, y no se inventan números sueltos:
  `--z-map` < `--z-markers` < `--z-panels` < `--z-popups` < `--z-toasts` < `--z-modal`.
- Los paneles tienen fondo semitransparente con desenfoque (`backdrop-filter`) y un fondo opaco de
  respaldo para los navegadores sin soporte. El texto tiene que mantener contraste AA sobre cualquier
  parte del mapa.

### 3. Alta densidad

Los paneles parecen el tablero de un controlador aéreo: mucha información, poco aire.
- Padding de 4 a 8 px dentro de los paneles, y gaps de 2 a 6 px entre filas.
- Escala de texto (tokens en `src/styles/tokens.css`): **mínimo 12 px**, cuerpo 13 px, números críticos
  (reloj, cuenta regresiva, ETA) 16 px o más, reloj 28 px. Todo se multiplica por `--text-scale`, el
  ajuste de tamaño de texto. Es el punto medio entre la densidad de un tablero de control y la
  legibilidad que pide `game-ui-design` (que, pensada para TV, pide 14 px): acá se juega en un monitor
  a un brazo de distancia.
- Los títulos de panel son chicos, en mayúsculas y con tracking, no titulares grandes.
- Una fila por pedido o repartidor, con los datos alineados en columnas.
- Nada de tarjetas gordas, sombras grandes, ilustraciones decorativas ni gradientes.
- Los colores tienen significado (urgente, tarde, elegido, libre, frío) y no se usan para decorar.

### 4. Tipografía táctica

- **Monospace** (JetBrains Mono o Roboto Mono, desde Google Fonts) para todo lo que se lee como dato:
  reloj, temporizadores, cuentas regresivas, número de pedido (`#12`), ETA, estrellas, dinero,
  porcentajes y calor de la comida. Siempre con `font-variant-numeric: tabular-nums`, para que los
  números no salten.
- Una sans neutra (la del sistema o Inter) para las etiquetas y los textos.
- Como máximo dos familias tipográficas, cargadas con `display=swap`.

### 5. Interacción

- **Drag and drop:** arrastrar un repartidor a un pedido (o un pedido a un repartidor) lo despacha.
  Mientras se arrastra, se resaltan los destinos válidos y se marcan los que no se pueden usar.
  Arrastrar convive con los dos clics de hoy y con el teclado (1–9, L, Esc, Espacio); nunca los
  reemplaza.
- **Modales no bloqueantes:** el reloj sigue y el mapa se puede usar mientras hay un panel o una
  tarjeta abierta. Solo el briefing y los resultados frenan el juego.
- Respuesta inmediata a cada acción: hover, elegido y arrastrando, cada uno con su estado. Las
  transiciones duran menos de 150 ms y respetan `prefers-reduced-motion`.

## Zonas operativas

Antes de tocar código, ubicá todo en una de estas zonas. Cada una es un área de atención con un solo
trabajo. Si algo no entra en ninguna, probablemente no hace falta.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR · Recursos      kr 1.240 · ★ 4,2 · ☎ 1     19:24     ⏸ 1x 2x 3x  🔊 │
├──────────────┬──────────────────────────────────────────────┬──────────────┤
│ IZQUIERDA    │                                              │ DERECHA      │
│ Incidentes   │   ┌ Pedido #12 · B · 4 min ─── ☎ Llamar ┐    │ Unidades     │
│ (Order Queue)│   └──────────────────────────────────────┘    │ (Rider       │
│              │                                              │  Roster)     │
│ #12 B  04:10 │             CENTRO · El mundo                │ 1 🚲 Libre   │
│ #13 A  02:30 │       mapa a pantalla completa, de fondo     │ 2 🛹 → B 3m  │
│ #14 D  00:45 │       restaurantes · clientes · repartidores │ 3 🛴 ⚡ 18 % │
│ …            │       rutas en vivo · vista previa           │ …            │
│              │                                              │              │
│              │                                  © OSM  [+ −]│              │
└──────────────┴──────────────────────────────────────────────┴──────────────┘
   los paneles flotan sobre el mapa: el mapa sigue por debajo de los tres
```

### Centro: el mundo

- Mapa de MapLibre con el estilo nocturno propio (`src/map/nightStyle.ts`) sobre OpenFreeMap.
  No usar Leaflet ni Mapbox: Mapbox pide API key y Leaflet no está en la lista de recursos permitidos.
- Íconos de restaurantes, clientes y repartidores moviéndose en tiempo real. Rutas con brillo
  (`src/map/routeLayers.ts`) y la vista previa del viaje que se está armando.
- Arriba al centro, debajo de la top bar, va la barra del pedido elegido (`SelectionBar`). Abajo a la
  derecha, la atribución de OSM y el zoom. Los avisos de eventos (lluvia, maratón) entran arriba al
  centro y se van solos.

### Panel izquierdo: incidentes (Order Queue)

- Una fila por pedido: número (`#12`), letra del restaurante, cuenta regresiva y estado
  (en la cocina, esperando repartidor). Los más urgentes van arriba.
- Semáforo de urgencia en la cuenta regresiva, con los umbrales de `urgencyOf`:
  **verde** con tiempo de sobra (`normal`), **amarillo** con menos de `orders.urgentBelowSec`
  (`urgent`) y **rojo** cuando ya está tarde (`late`). El color nunca es la única señal: el texto
  también dice "Tarde".
- Es origen y destino de arrastre: se arrastra un pedido a un repartidor, o un repartidor a un pedido.
  Shift + clic suma pedidos del mismo restaurante al viaje.
- Hoy existe como `OrderPanel` (columna fija a la izquierda).

### Panel derecho: unidades (Rider Roster)

- Una fila por repartidor: número (tecla 1–9), ícono del vehículo, estado, carga (`2/2`), ETA y
  calor de la comida que lleva. Al abrirla muestra las paradas, que se pueden arrastrar.
- Estados: **libre**, **yendo al restaurante**, **esperando la cocina**, **yendo al cliente**. Llegan
  más adelante: **sin batería** (#65) y **cansado** (energía del GDD, todavía sin tarea).
- Los libres van arriba. Con un pedido elegido, se ordenan por ETA.
- Hoy existe como `RiderPanel` (columna fija a la derecha).

### Top bar: recursos y tiempo

- **Izquierda:** nombre del juego y chip del nivel. **Centro:** hora del juego en monospace grande,
  con el estado (en pausa, terminado). **Derecha:** recursos y controles.
- Recursos:
  - **Dinero acumulado:** llega con #62.
  - **Reputación del servicio:** hoy son las estrellas del turno (`ShiftRating`). Una reputación que
    dure entre turnos sería una tarea nueva.
  - **Llamadas que quedan:** ya existe.
- Controles del tiempo:
  - Pausa (Espacio) y un control segmentado **1x / 2x / 3x**. Hoy hay un botón que alterna 1x y 2x
    (`clock.fastSpeed`). Para sumar 3x, las velocidades salen de la planilla como una lista, no del
    código.
  - Sonido y volumen (M).

### Capas por encima de todo

- **No bloquean:** la barra del pedido elegido, la tarjeta del restaurante en el mapa y los avisos.
- **Frenan el juego:** solo el briefing (antes del turno) y los resultados (al terminar).

## Reglas del proyecto que siguen valiendo

Estas vienen de `CLAUDE.md` y del trabajo hecho; la skill no las reemplaza.
- Textos visibles en `src/i18n/es.json`; nada de texto suelto en los componentes.
- Ningún número de juego en el código. Los números de diseño (tamaños, opacidades, z-index) van como
  tokens CSS en `:root`, con su versión oscura.
- Componentes chicos, de menos de ~300 líneas. Un archivo CSS por zona de la pantalla.
- Solo recursos gratuitos de la lista de `CLAUDE.md`: Google Fonts, Lucide, Kenney.
- La atribución de OpenStreetMap siempre visible.
- La pantalla tiene que funcionar a 1440 px y a 1024 px de ancho, sin scroll y sin texto cortado.
- Accesibilidad: foco visible, todo se puede usar con teclado, roles y etiquetas ARIA, contraste AA.
- Los tests de navegador (Playwright) buscan por rol, texto y `data-testid`. Si cambia la estructura,
  se actualizan los tests en el mismo Pull Request.

## Antes de dar por terminada una pantalla

- [ ] No hay scroll de página a 1440 × 900 ni a 1024 × 768.
- [ ] El mapa ocupa todo el fondo y ningún panel lo tapa por completo.
- [ ] Todos los números van en monospace con `tabular-nums`.
- [ ] Ningún texto mide menos de 12 px y los números críticos miden 16 px o más.
- [ ] Ningún panel tiene padding mayor a 8 px.
- [ ] Cada acción con atajo muestra su tecla dibujada (`Keycap`) y está en la leyenda de `?`.
- [ ] Se puede despachar con mouse (clics y arrastre) y con teclado.
- [ ] Hay capturas a 1440 px y 1024 px, en claro y oscuro, adjuntas al Pull Request.
