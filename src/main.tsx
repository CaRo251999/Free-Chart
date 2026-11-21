import { render } from 'preact';
import { App } from './app';
import { lang } from './i18n';
import './styles/tokens.css';
import './styles/base.css';
import { registerSW } from 'virtual:pwa-register';

document.documentElement.lang = lang.value;
render(<App />, document.getElementById('app') as HTMLElement);
registerSW({ immediate: true });
