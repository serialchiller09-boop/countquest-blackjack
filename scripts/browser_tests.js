/* Real-browser verification: load index.html?test=1 in Chromium and run embedded runTests(). */
const puppeteer = require('puppeteer-core');
const bootChrome = require('./browser_env');
(async () => {
  const errors = [];
  const browser = await puppeteer.launch({
    executablePath: await bootChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text().slice(0, 300)); });
  await page.goto('http://127.0.0.1:8080/index.html?test=1', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction('window.__runTestsDone === true', { timeout: 120000 });
  const banner = await page.evaluate(() => {
    const b = document.getElementById('test-banner');
    return { text: b?.textContent || '', cls: b?.className || '' };
  });
  const bootError = await page.evaluate(() => !!document.querySelector('#screen-menu'));
  console.log('banner:', banner.text);
  console.log('banner class:', banner.cls);
  console.log('lobby present:', bootError);
  console.log('errors:', errors.length);
  for (const e of errors.slice(0, 10)) console.log('  ERR:', e);
  await browser.close();
  process.exit(banner.text.includes('passed') && errors.length === 0 ? 0 : 1);
})();
