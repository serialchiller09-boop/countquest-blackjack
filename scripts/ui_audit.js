/* Real-browser UI audit: lobby -> table lobby -> bet -> play, at multiple viewports.
   Checks: page errors, horizontal overflow, tap targets, key element visibility. */
const puppeteer = require('puppeteer-core');
const bootChrome = require('./browser_env');
const startStaticServer = require('./static_server');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'artifacts');
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small', width: 360, height: 640 },
];

const auditPage = (page) => page.evaluate(() => {
  const issues = [];
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  // horizontal overflow
  const docW = document.documentElement.scrollWidth;
  if (docW > vw + 2) issues.push(`HORIZONTAL OVERFLOW: doc=${docW} vw=${vw}`);
  // body scroll
  const bodyH = document.body.scrollHeight;
  if (bodyH > vh + 2 && document.body.classList.contains('casino-play-active')) {
    issues.push(`BODY SCROLLS during play: ${bodyH} vs ${vh}`);
  }
  return { issues, vw, vh, bodyH };
});

const tapTargets = (page) => page.evaluate(() => {
  // Effective hit area includes ::before/::after inset expansion (e.g. the
  // lobby currency "+" buttons), which getBoundingClientRect() ignores.
  const eff = (el) => {
    const r = el.getBoundingClientRect();
    let w = r.width, h = r.height;
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (cs.content === 'none' || cs.content === 'normal' || !cs.position) continue;
      const m = /^\s*(-?[\d.]+)px\s*$/.exec(cs.inset || '');
      if (m) { const px = parseFloat(m[1]); w += Math.abs(px) * 2; h += Math.abs(px) * 2; }
    }
    return { w, h, r };
  };
  const out = [];
  const sel = 'button, [role="button"], a, summary, label, input[type="checkbox"]';
  document.querySelectorAll(sel).forEach(el => {
    const { w, h, r } = eff(el);
    const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && el.offsetParent !== null;
    if (!visible) return;
    const inView = r.left < innerWidth && r.right > 0 && r.top < innerHeight && r.bottom > 0;
    if (!inView) return;
    if (w < 40 || h < 40) {
      const id = el.id ? `#${el.id}` : '';
      const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0, 2).join('.') : '';
      out.push(`${el.tagName.toLowerCase()}${id}.${cls} ${Math.round(w)}x${Math.round(h)} (visual ${Math.round(r.width)}x${Math.round(r.height)})`);
    }
  });
  return out.slice(0, 15);
});

(async () => {
  const allIssues = [];
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startStaticServer();
  const browser = await puppeteer.launch({
    executablePath: await bootChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text().slice(0, 200)); });

    const report = { viewport: vp.name, errors: [] };
    try {
      await page.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForFunction("() => !document.getElementById('screen-menu').className.includes('hidden')", { timeout: 20000 });
      await new Promise(r => setTimeout(r, 600));

      // LOBBY
      let audit = await auditPage(page);
      report.lobby = { issues: audit.issues };
      report.lobbyTapTargets = await tapTargets(page);
      await page.screenshot({ path: path.join(OUT, `audit-${vp.name}-1-lobby.png`) });

      // TABLE LOBBY
      await page.evaluate(() => document.getElementById('lobby-hero-play').click());
      await page.waitForSelector('[data-table-tier]', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 400));
      report.phaseAfterHero = await page.evaluate(() => window.app?.phase);
      audit = await auditPage(page);
      report.tableLobby = { issues: audit.issues };
      await page.screenshot({ path: path.join(OUT, `audit-${vp.name}-2-table-lobby.png`) });

      // START SESSION -> bet phase
      await page.evaluate(() => {
        const tier = document.querySelector('[data-table-tier]:not([disabled])') || document.querySelector('[data-table-tier]');
        tier.click();
      });
      await page.waitForFunction("() => { try { return ['bet','countConfirm','playing'].includes(window.app?.phase); } catch (e) { return false; } }", { timeout: 20000 });
      await new Promise(r => setTimeout(r, 500));
      audit = await auditPage(page);
      report.betPhase = { issues: audit.issues, phase: await page.evaluate(() => window.app.phase) };
      await page.screenshot({ path: path.join(OUT, `audit-${vp.name}-3-bet.png`) });

      // PLACE BET + DEAL
      await page.evaluate(() => { const inp = document.getElementById('bet-input'); if (inp) { inp.value = '100'; inp.dispatchEvent(new Event('input', { bubbles: true })); } });
      await page.evaluate(() => document.getElementById('btn-deal').click());
      const dealTrace = [];
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 200));
        const s = await page.evaluate(() => ({ phase: window.app.phase, dealing: window.app.dealing, dc: window.app.dealer?.cards?.length }));
        dealTrace.push(s);
        if (s.phase === 'playing' && !s.dealing && s.dc >= 2) break;
      }
      report.dealTrace = dealTrace;
      await new Promise(r => setTimeout(r, 400));
      audit = await auditPage(page);
      report.playingPhase = { issues: audit.issues, phase: await page.evaluate(() => window.app.phase) };
      report.playTapTargets = await tapTargets(page);
      await page.screenshot({ path: path.join(OUT, `audit-${vp.name}-4-playing.png`) });

      // STAND -> hand end / auto-flow
      await page.evaluate(() => window.app.playerAction('stand'));
      await page.waitForFunction("() => { try { const a = window.app; return a && (a.results?.length > 0 || a._awaitingNextHand || a.phase === 'handEnd'); } catch (e) { return false; } }", { timeout: 20000 });
      await new Promise(r => setTimeout(r, 800));
      audit = await auditPage(page);
      report.handEnd = { issues: audit.issues, phase: await page.evaluate(() => window.app.phase), awaiting: await page.evaluate(() => window.app._awaitingNextHand) };
      await page.screenshot({ path: path.join(OUT, `audit-${vp.name}-5-handend.png`) });

      report.errors = errors;
    } catch (e) {
      report.errors.push('AUDIT THREW: ' + e.message.slice(0, 300));
    }
    allIssues.push(report);
    await page.close();
  }
  await browser.close();
  await server.close();
  fs.writeFileSync(path.join(OUT, 'ui-audit-report.json'), JSON.stringify(allIssues, null, 2));
  console.log(JSON.stringify(allIssues, null, 2));
  const failed = allIssues.some(r => (r.errors && r.errors.length)
    || Object.values(r).some(v => v && typeof v === 'object' && Array.isArray(v.issues) && v.issues.length));
  process.exit(failed ? 1 : 0);
})();
