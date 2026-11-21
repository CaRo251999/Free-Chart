import { lang, t } from '../i18n';

const NOTICE = 'TradingView Lightweight Charts™\nCopyright (с) 2025 TradingView, Inc. https://www.tradingview.com/';

const DEPS: [string, string, string][] = [
  ['lightweight-charts 5.3.0', 'Apache-2.0', 'https://github.com/tradingview/lightweight-charts'],
  ['fancy-canvas', 'MIT', 'https://github.com/tradingview/fancy-canvas'],
  ['preact 11', 'MIT', 'https://github.com/preactjs/preact'],
  ['@preact/signals', 'MIT', 'https://github.com/preactjs/signals'],
  ['idb', 'ISC', 'https://github.com/jakearchibald/idb'],
];

export function Credits() {
  return (
    <article class="page">
      <h1>{t('credits')}</h1>
      <p>{lang.value === 'es' ? 'Free Chart es software libre bajo licencia MIT.' : 'Free Chart is free software under the MIT license.'}</p>
      <h2>{t('noticeTitle')}</h2>
      <pre class="notice">{NOTICE}</pre>
      <p>
        {lang.value === 'es' ? 'Esta app usa Lightweight Charts™ de ' : 'This app uses Lightweight Charts™ by '}
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView</a>.
      </p>
      <p>{t('notAffiliated')}</p>
      <h2>{lang.value === 'es' ? 'Dependencias' : 'Dependencies'}</h2>
      <table class="table">
        <tbody>
          {DEPS.map(([n, l, u]) => (
            <tr key={n}>
              <td><a href={u} target="_blank" rel="noopener noreferrer">{n}</a></td>
              <td>{l}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>{lang.value === 'es' ? 'Datos de mercado' : 'Market data'}</h2>
      <p>
        {lang.value === 'es'
          ? 'Endpoints públicos de Coinbase Exchange, Kraken, Binance, OKX y Bybit, consultados directamente desde tu navegador. Las marcas pertenecen a sus dueños.'
          : 'Public endpoints of Coinbase Exchange, Kraken, Binance, OKX and Bybit, queried directly from your browser. Trademarks belong to their owners.'}
      </p>
      <p><a href="#/">{t('back')}</a></p>
    </article>
  );
}

export function Terms() {
  const es = lang.value === 'es';
  return (
    <article class="page">
      <h1>{t('terms')}</h1>
      <p><strong>{t('disclaimer')}</strong></p>
      {es ? (
        <>
          <p>Free Chart se ofrece «tal cual», sin garantías de ningún tipo. Los precios y datos provienen de exchanges de terceros, pueden tener retrasos o errores y no constituyen recomendación de inversión, compra o venta.</p>
          <p>Operar criptomonedas implica un riesgo alto de pérdida. Tú eres el único responsable de tus decisiones.</p>
          <p>Binance, OKX y Bybit no están disponibles para residentes de EE.UU. OKX y Bybit solo se usan si los eliges manualmente; Binance también puede usarse como último recurso automático (la gráfica lo avisa). Es tu responsabilidad cumplir con las leyes y los términos de cada exchange en tu país.</p>
          <p>Las alertas de precio solo funcionan mientras la pestaña esté abierta.</p>
          <p>Free Chart no está afiliado ni respaldado por TradingView ni por ningún exchange.</p>
        </>
      ) : (
        <>
          <p>Free Chart is provided "as is", without warranties of any kind. Prices and data come from third-party exchanges, may be delayed or wrong, and are not investment advice or a recommendation to buy or sell.</p>
          <p>Trading crypto carries a high risk of loss. You alone are responsible for your decisions.</p>
          <p>Binance, OKX and Bybit are not available to US residents. OKX and Bybit are only used if you pick them manually; Binance may also serve as an automatic last resort (the chart warns you). It is your responsibility to comply with the laws and exchange terms of your country.</p>
          <p>Price alerts only work while the tab is open.</p>
          <p>Free Chart is not affiliated with or endorsed by TradingView or any exchange.</p>
        </>
      )}
      <p><a href="#/">{t('back')}</a></p>
    </article>
  );
}

export function Privacy() {
  const es = lang.value === 'es';
  return (
    <article class="page">
      <h1>{t('privacy')}</h1>
      {es ? (
        <>
          <p>Free Chart no tiene servidor propio, cuentas, analytics ni cookies de rastreo.</p>
          <p>Tus listas, dibujos, alertas y ajustes se guardan solo en el almacenamiento local de tu navegador (localStorage / IndexedDB). Puedes exportarlos o borrarlos cuando quieras.</p>
          <p>Para mostrar precios, tu navegador se conecta directamente a los servidores públicos de los exchanges (Coinbase, Kraken y, si los eliges, Binance, OKX o Bybit). Esos servicios pueden ver tu dirección IP, como en cualquier sitio web, según sus propias políticas. No se envían datos personales ni claves.</p>
          <p>Los enlaces para compartir listas codifican la lista dentro de la URL (después del #); nada se sube a ningún servidor.</p>
        </>
      ) : (
        <>
          <p>Free Chart has no server of its own, no accounts, no analytics and no tracking cookies.</p>
          <p>Your lists, drawings, alerts and settings are stored only in your browser's local storage (localStorage / IndexedDB). You can export or delete them at any time.</p>
          <p>To show prices, your browser connects directly to the exchanges' public servers (Coinbase, Kraken and, if you choose them, Binance, OKX or Bybit). Those services can see your IP address, as on any website, under their own policies. No personal data or keys are sent.</p>
          <p>Share links encode the list inside the URL (after the #); nothing is uploaded to any server.</p>
        </>
      )}
      <p><a href="#/">{t('back')}</a></p>
    </article>
  );
}
