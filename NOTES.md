# NOTES

## Verificación de exchanges (2026-11-21, desde mi red; sin VPN)

REST con cabecera `Origin: http://localhost:5173`; WebSocket abierto con `WebSocket` de Node.

| Exchange | REST+CORS | WebSocket | Notas |
|---|---|---|---|
| Coinbase Exchange | OK (`ACAO: *`) | OK | Permite EE.UU. Máx. 300 velas/petición; sin 4h ni 1S nativos (se agregan). |
| Kraken | OK (refleja Origin) | OK (v2) | Permite EE.UU. OHLC devuelve las últimas 720 velas. |
| Binance (data-api.binance.vision) | OK (`ACAO: *`) | OK | **No disponible para residentes de EE.UU.** (solo manual). |
| OKX | OK (refleja Origin) | OK | **No disponible para residentes de EE.UU.** (solo manual). |
| Bybit | 403 desde esta red | no probado | **No disponible para residentes de EE.UU.**; bloqueo geográfico. Solo manual. |
| MEXC | 200 pero sin `Access-Control-Allow-Origin` | no probado | Descartado: el navegador bloquearía la lectura (CORS). |

Limitación: solo puedo comprobar el comportamiento desde mi ubicación; el geobloqueo desde EE.UU. se
documenta según los términos de cada exchange y se cubre con el respaldo automático.

Orden automático (decisión del usuario): Coinbase → Kraken → Binance (último recurso, con aviso en la gráfica).
OKX/Bybit solo si el usuario los elige a mano, con aviso para residentes de EE.UU.

## Licencias de desarrollo con excepción

`npm run licenses` exige MIT/Apache-2.0/BSD/ISC en dependencias de ejecución (hoy: las 6 cumplen).
Excepciones SOLO de desarrollo (no se empaquetan en el sitio):
- `lightningcss` (MPL-2.0): lo usa Vite internamente para CSS.
- `spdx-exceptions` (CC-BY-3.0): transitiva de herramientas de auditoría/lint.

## NOTICE de lightweight-charts

El paquete npm no incluye NOTICE; se copió desde el repositorio oficial a `public/NOTICE-lightweight-charts.txt`
y se muestra en la página Créditos.

## Decisiones y limitaciones (cierre)

- **Orden automático**: Coinbase → Kraken → Binance (decisión del usuario). Binance es el último recurso y la gráfica muestra un
  aviso de que no está disponible para residentes de EE.UU. cuando lo usa sin haber sido elegido. OKX y Bybit solo se usan si
  el usuario los elige a mano (con aviso al elegirlos).
- **Bybit**: implementado según la API V5 documentada pero **sin verificar en vivo** (403 desde la red de pruebas).
  Es manual-only; si falla, el respaldo automático pasa a Coinbase/Kraken.
- **MEXC**: descartado (la respuesta REST no incluye `Access-Control-Allow-Origin`; el navegador bloquearía la lectura).
- **Geobloqueo desde EE.UU.** no se pudo probar desde la red de desarrollo; se documenta según términos de cada exchange.
- **Kraken**: `changePct` usa la apertura del día UTC (la API no da apertura móvil de 24h). Historial limitado a 720 velas.
- **Coinbase / Kraken**: 4h y 1S se construyen agregando velas de 1h / 1D (1S alineada al lunes UTC).
- **Ichimoku**: se dibujan las 5 líneas (Span A/B proyectadas hacia el futuro, Chikou hacia atrás) pero **sin relleno de la
  nube** (lightweight-charts no rellena entre series sin un primitive dedicado).
- **Eje horario**: el eje de tiempo se muestra en hora local del usuario.
- **Alertas**: solo con la pestaña abierta (sin servidor no hay push). Se explica en la UI. Las notificaciones del
  navegador requieren permiso; si se deniega, se usan sonido y aviso en pantalla.
- **Captura PNG**: añade franja con título y pie con la atribución de Lightweight Charts™.
- **Pruebas en vivo**: 36 pruebas contra los exchanges (`LIVE=1 npx vitest run src/exchanges/live.test.ts`) pasaron el
  2026-11-21 (velas 1m/1h/4h/1d/1w, ticker, símbolos, paginación hacia atrás y WebSocket en Coinbase, Kraken, Binance y OKX).
- **Verificación visual**: hecha con Chrome headless (CDP) sobre la compilación de producción: gráfica, listas,
  indicadores, las 12 herramientas de dibujo (ratón y táctil), 4 gráficas, comparar, alertas, respaldo y captura.
  La CSP de `vercel.json` se validó sin violaciones.
- **Bugs encontrados y corregidos durante la verificación**: (1) un clic simple se interpretaba como arrastre al
  dibujar (sobre todo en táctil); (2) al cambiar de par, el paginado hacia atrás usaba el exchange/símbolo del par
  anterior y mezclaba velas; (3) la barra de herramientas se desbordaba a 1280 px y recortaba el menú «Más».
- **No verificado**: despliegue real en Vercel/Cloudflare/GitHub Pages (solo se validó localmente la CSP y la
  compilación); notificaciones del navegador (el permiso no se puede conceder en Chrome headless; sonido y aviso
  en pantalla sí); navegadores distintos de Chrome.
