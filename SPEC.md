# PROYECTO: Free Chart — plataforma de gráficas cripto gratuita y de código abierto

## Rol y objetivo
Eres un ingeniero frontend senior. Construye "Free Chart", una web app de
gráficas y seguimiento de criptomonedas, gratuita y de código abierto, para
la comunidad cripto hispanohablante. Debe ser una alternativa ligera a
plataformas de pago: seguir precios, dibujar sobre la gráfica y usar
indicadores, SIN límites artificiales. Costo de operación: $0.

## Reglas legales (OBLIGATORIAS, no negociables)
1. Nombre ("Free Chart"), logo, colores y diseño ORIGINALES. Prohibido usar
   el nombre "TradingView", su logo, iconos, textos o copiar su interfaz
   pixel por pixel. Inspírate en lo funcional, no en la identidad visual.
2. NUNCA hagas scraping de TradingView ni de ningún sitio. No uses sus
   datos, scripts Pine ni widgets embebidos como base de la app.
3. Librería de gráficas: "lightweight-charts" (oficial, Apache 2.0).
   Cumple su licencia: deja visible el attributionLogo (link a
   tradingview.com) e incluye el NOTICE en una página "Créditos".
4. Antes de agregar CUALQUIER dependencia, verifica su licencia. Solo
   MIT, Apache 2.0, BSD o ISC. Lista todas en CREDITS.md.
5. Datos de mercado: solo endpoints PÚBLICOS de exchanges, sin API keys,
   respetando sus límites de uso (rate limits) y términos. Las llamadas
   se hacen desde el navegador del usuario (sin servidor propio).
6. Privacidad: sin login, sin base de datos, sin cookies de rastreo, sin
   analytics. Todo se guarda en localStorage/IndexedDB del usuario.
7. Aviso visible: "Solo con fines informativos. No es asesoría
   financiera." Incluye página de Términos y Privacidad simples.
8. Licencia del proyecto: MIT. Archivo LICENSE en la raíz.

## Stack
- Vite + TypeScript + vanilla o Preact (lo más ligero posible).
- lightweight-charts v5 (con su API de plugins/primitives y panes).
- Sin backend. Desplegable como sitio estático (Vercel, Cloudflare
  Pages o GitHub Pages).
- PWA instalable en celular (manifest + service worker para el shell).
- Entorno de desarrollo: Windows 11, PowerShell, Node.js v26, Git.
  Usa scripts de npm compatibles con Windows (nada de comandos solo-bash).

## Fuentes de datos (con capa de adaptadores)
- Crea una interfaz `ExchangeAdapter` (buscarSímbolos, velasHistóricas,
  streamTiempoReal vía WebSocket, ticker24h).
- Implementa al menos 3 adaptadores. VERIFICA tú mismo, con pruebas
  reales, cuáles permiten CORS desde navegador y cuáles bloquean
  usuarios de EE.UU. Candidatos: Binance (data-api.binance.vision),
  Coinbase Exchange, Kraken, OKX, Bybit, MEXC.
- Respaldo automático: si un exchange falla o está bloqueado, usa otro.
- El usuario elige el exchange por par, o "automático".
- Cache de velas en memoria + IndexedDB para no repetir peticiones.
- Reconexión automática de WebSocket con backoff.

## Funciones (prioridad en orden; marca cada una al terminarla)

### Fase 1 – Base
- [x] Gráfica de velas con volumen, zoom, desplazamiento, crosshair.
- [x] Temporalidades: 1m, 5m, 15m, 1h, 4h, 1D, 1S.
- [x] Tipos: velas, línea, área, Heikin Ashi.
- [x] Precio en tiempo real vía WebSocket.
- [x] Tema oscuro (por defecto) y claro.

### Fase 2 – Watchlists sin límites
- [x] Listas ilimitadas, con activos ilimitados por lista.
- [x] Buscador de pares en todos los exchanges.
- [x] Columnas: precio, % 24h, volumen 24h, ordenables.
- [x] Banderas de colores (7 colores) y notas por activo.
- [x] Arrastrar para reordenar.
- [x] Importar/exportar listas en JSON y CSV.
- [x] Compartir lista por link (estado codificado en la URL, sin servidor).

### Fase 3 – Indicadores (ilimitados por gráfica)
- [x] En el gráfico: SMA, EMA, WMA, VWAP, Bandas de Bollinger,
      Ichimoku, Supertrend, Parabolic SAR.
- [x] En panel inferior: RSI, MACD, Stoch RSI, ATR, OBV, ADX, Volumen.
- [x] Parámetros editables (períodos, colores, grosor).
- [x] Plantillas de indicadores guardables.
- [x] Implementa los cálculos tú mismo en /src/indicators con pruebas
      unitarias contra valores conocidos.

### Fase 4 – Herramientas de dibujo
- [x] Línea de tendencia, rayo, línea horizontal y vertical, canal
      paralelo, rectángulo, retroceso de Fibonacci, texto, flecha,
      regla de medición (% y precio), posición larga/corta (R:R).
- [x] Seleccionar, mover, editar color/grosor y borrar.
- [x] Imán a OHLC (on/off).
- [x] Dibujos guardados por símbolo en localStorage.
- [x] Deshacer/rehacer (Ctrl+Z / Ctrl+Y).
- [x] Usa los primitives de lightweight-charts v5. Si usas un plugin
      externo de dibujo, solo con licencia MIT/Apache y acreditado.

### Fase 5 – Extras
- [x] Layouts multi-gráfica: 1, 2, 4 gráficas con crosshair sincronizado.
- [x] Alertas de precio ilimitadas (notificación del navegador + sonido,
      funcionan con la pestaña abierta; explícalo en la UI).
- [x] Comparar símbolos (overlay en %).
- [x] Atajos de teclado.
- [x] Captura de la gráfica como imagen (PNG) para compartir.
- [x] Respaldo/restauración de TODO (listas, dibujos, ajustes) en un JSON.
- [x] Idiomas: español (por defecto) e inglés.

## Calidad
- Responsive: debe funcionar bien en celular (gestos táctiles para
  dibujar y hacer zoom) y en escritorio.
- Rendimiento: carga inicial < 300 KB gzip (sin contar la librería de
  gráficas), 60 fps al desplazar.
- Accesible: contraste AA, navegación con teclado.
- Vitest para indicadores y adaptadores (con mocks).
- `npm run build`, `npm run lint` y `npm test` sin errores.

## Entregables
- Código en el repositorio, con commits por fase (mensajes claros) y
  push a origin (GitHub: CaRo251999/Free-Chart, rama main).
- README.md en español e inglés: qué es, capturas, cómo correrlo,
  cómo desplegarlo gratis en Vercel/Cloudflare Pages/GitHub Pages,
  cómo agregar un exchange nuevo, cómo contribuir.
- CREDITS.md, LICENSE (MIT), página de Créditos y aviso legal.
- Archivo de configuración listo para desplegar (vercel.json o similar).

## Forma de trabajar (ahorro de tokens)
- Trabaja por fases en orden. Al terminar cada una: build + lint + tests,
  commit, push y marca las casillas [x] en este SPEC.md.
- No leas node_modules ni archivos generados. Lee solo lo necesario.
- No reescribas archivos completos si basta un cambio puntual.
- Si algo no es posible gratis o legalmente, anótalo en
  NOTES.md con la razón y sigue con lo siguiente; no te detengas.
- Al final, haz un resumen corto de lo hecho y lo pendiente.
