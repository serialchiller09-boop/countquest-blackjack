#!/usr/bin/env node
/* Load index.html in jsdom, run the embedded runTests(), report errors. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Collect scripts (inline + external) in document order to execute manually.
const scriptTags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const srcs = [];
for (const m of scriptTags) {
  const attrs = m[1] || '';
  const srcMatch = attrs.match(/src="([^"]+)"/);
  if (srcMatch) srcs.push({ type: 'src', value: srcMatch[1] });
  else if (m[2] && m[2].trim()) srcs.push({ type: 'inline', value: m[2] });
}

const errors = [];
const consoleLogs = [];

const dom = new JSDOM(html, {
  url: 'http://localhost/index.html?test=1',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.addEventListener('error', (e) => {
      errors.push(`window error: ${e.message} @ ${e.filename}:${e.lineno}`);
    });
  },
});

// Inline the linked stylesheets (jsdom doesn't fetch <link> CSS).
for (const cssPath of ['css/tailwind.css', 'css/app.css', 'css/casino-felt-table.css']) {
  try {
    const css = fs.readFileSync(path.join(root, cssPath), 'utf8');
    const style = dom.window.document.createElement('style');
    style.textContent = css;
    dom.window.document.head.appendChild(style);
  } catch (e) {
    errors.push(`cannot read css ${cssPath}: ${e.message}`);
  }
}

const { window } = dom;

// Minimal stubs for APIs the app may use that jsdom lacks.
window.matchMedia = window.matchMedia || (() => ({
  matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
}));
window.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(() => cb(Date.now()), 16));
window.cancelAnimationFrame = window.cancelAnimationFrame || ((id) => clearTimeout(id));
window.HTMLDialogElement.prototype.showModal = window.HTMLDialogElement.prototype.showModal || function () { this.setAttribute('open', ''); };
window.HTMLDialogElement.prototype.close = window.HTMLDialogElement.prototype.close || function () { this.removeAttribute('open'); };
if (!window.navigator.vibrate) window.navigator.vibrate = () => true;
window.scrollTo = window.scrollTo || (() => {});
window.localStorage = window.localStorage || { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// localStorage works in jsdom, but clear for a clean run.
try { window.localStorage.clear(); } catch (e) {}

const origError = console.error;
const origLog = console.log;
window.console.error = (...a) => { errors.push('console.error: ' + a.map(String).join(' ')); };
window.console.log = (...a) => { consoleLogs.push(a.map(String).join(' ')); };

let scriptFailed = null;
// In a browser, top-level `const`/`let` from one script are visible to the
// next (shared global lexical scope). jsdom's per-eval scoping breaks that,
// so concatenate all scripts in document order and eval once.
const parts = [];
for (const s of srcs) {
  if (s.type === 'src') {
    const file = path.join(root, s.value.split('?')[0]);
    try {
      parts.push(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`cannot read ${s.value}: ${e.message}`);
    }
  } else {
    parts.push(s.value);
  }
}
try {
  window.eval(parts.join('\n;\n'));
} catch (e) {
  scriptFailed = e.stack || e.message;
  errors.push(`eval scripts: ${e.message}`);
}

if (!scriptFailed) {
  // Run embedded tests if the URL asks for it.
  try {
    if (typeof window.runTests === 'function') {
      window.runTests();
    }
  } catch (e) {
    errors.push(`runTests threw: ${e.stack || e.message}`);
  }
}

const banner = window.document.getElementById('test-banner');
const bannerText = banner ? (banner.textContent || '') : '(no banner)';
const appReady = !!window.app || !!window.CQ;

console.log('=== JSDOM PROBE ===');
console.log('script eval failure:', scriptFailed || 'none');
console.log('app global:', appReady);
console.log('runTests done:', window.__runTestsDone);
console.log('banner:', bannerText.trim());
console.log('errors:', errors.length);
for (const e of errors.slice(0, 30)) console.log('  ERR:', e);
// Print the final "All CountQuest tests passed" if present
const passLine = consoleLogs.find(l => l.includes('All CountQuest tests passed'));
console.log('pass line:', passLine || '(none)');
process.exit(errors.length ? 1 : 0);
