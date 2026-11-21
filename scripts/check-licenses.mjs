// Audits licenses. Runtime (shipped) deps: only MIT, Apache-2.0, BSD, ISC.
// Dev-only tooling may also use other permissive licenses, plus the named
// exceptions below (documented in NOTES.md). Nothing dev-only is bundled.
import * as checker from 'license-checker-rseidelsohn';

const RUNTIME = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'];
const DEV_EXTRA = ['0BSD', 'BlueOak-1.0.0', 'CC0-1.0', 'CC-BY-4.0', 'Unlicense', 'Python-2.0'];
const DEV_EXCEPTIONS = [/^lightningcss(-.+)?@/, /^spdx-exceptions@/];

const ok = (lic, allowed) =>
  String(lic).replace(/[()*]/g, '').split(/\s+(?:OR|AND)\s+/).some((l) => allowed.includes(l.trim()));

const run = (production) =>
  new Promise((res, rej) =>
    checker.init({ start: process.cwd(), production, excludePrivatePackages: true }, (e, p) => (e ? rej(e) : res(p))));

const prod = await run(true);
const all = await run(false);
let failed = false;

for (const [k, v] of Object.entries(prod)) {
  if (!ok(v.licenses, RUNTIME)) { console.error(`RUNTIME disallowed: ${k}: ${v.licenses}`); failed = true; }
}
for (const [k, v] of Object.entries(all)) {
  if (k in prod) continue;
  if (ok(v.licenses, [...RUNTIME, ...DEV_EXTRA])) continue;
  if (DEV_EXCEPTIONS.some((re) => re.test(k))) { console.log(`dev exception: ${k}: ${v.licenses}`); continue; }
  console.error(`DEV disallowed: ${k}: ${v.licenses}`); failed = true;
}
console.log(`runtime packages: ${Object.keys(prod).length}, total: ${Object.keys(all).length}`);
process.exit(failed ? 1 : 0);
