const puppeteer = require('puppeteer-core');
const boot = require('./browser_env');
const startStaticServer = require('./static_server');

const FLOWS = [
  { name: 'solo_practice', vp: { width: 390, height: 844 }, setup: () => { window.app.startSession(true, 'practice-range'); window.app.beginBetPhase(); } },
  { name: 'solo_campaign', vp: { width: 390, height: 844 }, setup: () => { window.app.startSession(false, 'campaign'); window.app.beginBetPhase(); } },
  { name: 'solo_practice_short', vp: { width: 360, height: 640 }, setup: () => { window.app.startSession(true, 'practice-range'); window.app.beginBetPhase(); } },
  { name: 'practice_l2_solo', vp: { width: 390, height: 844 }, setup: () => { window.app.save.helpLevel = 2; window.app.help.level = 2; window.app.startSession(true, 'practice-range'); window.app.beginBetPhase(); } },
];

(async () => {
  const server = await startStaticServer();
  const browser = await puppeteer.launch({ executablePath: await boot(), headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  let allPass = true;
  for (const flow of FLOWS) {
    const page = await browser.newPage();
    await page.setViewport(flow.vp);
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    try {
      await page.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForFunction(() => !!window.app, { timeout: 45000 });
      await page.evaluate(flow.setup);
      await new Promise(r => setTimeout(r, 400));
      await page.evaluate(() => { const b = document.getElementById('btn-deal'); if (b) b.click(); });
      await page.waitForFunction(() => window.app.phase === 'playing' && document.querySelectorAll('#player-hands .playing-card').length >= 2, { timeout: 25000 });
      await page.waitForFunction(() => !window.app.dealing, { timeout: 25000 });
      await page.evaluate(() => {
        const ins = document.getElementById('modal-insurance');
        if (ins?.open) window.app.resolveInsurance(false);
        document.querySelectorAll('dialog[open]').forEach(d => d.close());
      });
      await new Promise(r => setTimeout(r, 350));
      await page.evaluate(() => window.app.syncCasinoShellMetrics());
      const snap = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#player-hands .playing-card')];
        const rects = cards.map(c => c.getBoundingClientRect());
        return {
          layout: window.app.settings.tableLayout,
          fullClass: document.body.classList.contains('casino-table-full'),
          soloClass: document.body.classList.contains('casino-table-solo'),
          seats: [...document.querySelectorAll('#casino-seat-grid .casino-seat')].filter(e => !e.classList.contains('hidden')).length,
          playerInRail: !!document.getElementById('player-hands')?.closest('#casino-player-rail'),
          playerInSeat: !!document.getElementById('casino-seat-human')?.contains(document.getElementById('player-hands')),
          cardCount: cards.length,
          minCardW: rects.length ? Math.min(...rects.map(r => r.width)) : 0,
          separated: rects.length < 2 || Math.abs(rects[0].left - rects[1].left) > 12,
          headerH: document.getElementById('app-header').offsetHeight,
          actionBarH: document.getElementById('action-bar').offsetHeight,
        };
      });
      const checks = {
        player_in_rail: snap.playerInRail === true,
        player_not_in_seat: snap.playerInSeat === false,
        single_seat: snap.seats === 1,
        solo_body_class: snap.soloClass === true,
        cards_present: snap.cardCount >= 2,
        cards_separated: snap.separated === true,
        cards_large_enough: snap.minCardW >= 48,
      };
      const fails = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
      allPass = allPass && fails.length === 0 && errs.length === 0;
      console.log(`${flow.name}: ${fails.length === 0 && errs.length === 0 ? 'PASS' : 'FAIL'}  cards=${snap.minCardW.toFixed(1)}px header=${snap.headerH} actionbar=${snap.actionBarH}${fails.length ? ' fails=' + fails.join(',') : ''}${errs.length ? ' errs=' + errs.join(';') : ''}`);
    } catch (e) {
      allPass = false;
      console.log(`${flow.name}: THREW ${e.message.slice(0, 150)}`);
    }
    await page.close();
  }
  await browser.close();
  await server.close();
  console.log(allPass ? 'ALL FLOWS PASS' : 'SOME FLOWS FAILED');
  process.exit(allPass ? 0 : 1);
})();
