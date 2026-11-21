# Créditos / Credits

Free Chart es software libre (MIT). Free Chart is free software (MIT).

## Dependencias de ejecución / Runtime dependencies

| Paquete | Versión | Licencia | Uso |
|---|---|---|---|
| [lightweight-charts](https://github.com/tradingview/lightweight-charts) | 5.3.0 | Apache-2.0 | Motor de gráficas |
| [fancy-canvas](https://github.com/tradingview/fancy-canvas) | (transitiva) | MIT | Canvas de lightweight-charts |
| [preact](https://github.com/preactjs/preact) | 11.2.0 | MIT | UI |
| [@preact/signals](https://github.com/preactjs/signals) | 2.11.4 | MIT | Estado reactivo |
| [idb](https://github.com/jakearchibald/idb) | 8.0.4 | ISC | Envoltorio de IndexedDB |

### Aviso de atribución de lightweight-charts

```
TradingView Lightweight Charts™
Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/
```

Este producto usa Lightweight Charts™ de TradingView, Inc. (<https://www.tradingview.com/>).
Free Chart **no está afiliado ni respaldado** por TradingView.
El logo de atribución de la gráfica permanece visible (`attributionLogo`).

## Dependencias de desarrollo / Dev dependencies (no se distribuyen / not shipped)

Vite (MIT), @preact/preset-vite (MIT), vite-plugin-pwa (MIT) + Workbox (MIT), TypeScript (Apache-2.0),
Vitest (MIT), jsdom (MIT), fake-indexeddb (Apache-2.0), ESLint (MIT), typescript-eslint (MIT),
globals (MIT), license-checker-rseidelsohn (BSD-3-Clause).

Excepciones de desarrollo documentadas en NOTES.md (lightningcss MPL-2.0, spdx-exceptions CC-BY-3.0).
Ejecuta `npm run licenses` para auditar el árbol completo.

## Datos de mercado / Market data

Endpoints públicos de Coinbase Exchange, Kraken, Binance (data-api.binance.vision), OKX y Bybit,
consultados directamente desde el navegador del usuario. Sus marcas pertenecen a sus dueños.
