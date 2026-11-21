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

Orden automático (decisión del usuario): Coinbase → Kraken → Binance.
Binance/OKX/Bybit solo si el usuario los elige a mano, con aviso para residentes de EE.UU.

## Licencias de desarrollo con excepción

`npm run licenses` exige MIT/Apache-2.0/BSD/ISC en dependencias de ejecución (hoy: las 6 cumplen).
Excepciones SOLO de desarrollo (no se empaquetan en el sitio):
- `lightningcss` (MPL-2.0): lo usa Vite internamente para CSS.
- `spdx-exceptions` (CC-BY-3.0): transitiva de herramientas de auditoría/lint.

## NOTICE de lightweight-charts

El paquete npm no incluye NOTICE; se copió desde el repositorio oficial a `public/NOTICE-lightweight-charts.txt`
y se muestra en la página Créditos.
