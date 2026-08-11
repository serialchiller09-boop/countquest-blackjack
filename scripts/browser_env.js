/**
 * Self-contained headless-Chromium bootstrap for this sandbox/repo.
 *
 * Why: the official Playwright/Chrome CDNs are unreachable from this
 * environment, but the npm registry works. `@sparticuz/chromium` ships a
 * Chromium binary inside the npm package, and its `al2023.tar.br` bundle
 * includes the NSS shared libraries the binary needs on Debian-based hosts.
 *
 * Usage:
 *   const boot = require('./browser_env');
 *   const browser = await puppeteer.launch({ executablePath: await boot(), ... });
 *
 * This must run before the browser process spawns — it sets
 * process.env.LD_LIBRARY_PATH so the dynamic loader can find libnss3 etc.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { inflate, default: Chromium } = require('@sparticuz/chromium');

const PKG_BIN = path.resolve(__dirname, '..', 'node_modules', '@sparticuz', 'chromium', 'bin');
// NOTE: inflate() ignores its target arg for the tar bundles and always
// extracts to /tmp (the @sparticuz/chromium Lambda convention).
const LIB_DIR = '/tmp/al2023/lib';
const LIB_MARKER = path.join(LIB_DIR, 'libnss3.so');
const SWIFT_MARKER = '/tmp/libGLESv2.so';

async function bootstrap() {
  if (!fs.existsSync(LIB_MARKER)) {
    await inflate(path.join(PKG_BIN, 'al2023.tar.br'), LIB_DIR);
  }
  if (!fs.existsSync(SWIFT_MARKER)) {
    await inflate(path.join(PKG_BIN, 'swiftshader.tar.br'), '/tmp');
  }
  process.env.LD_LIBRARY_PATH = LIB_DIR
    + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '');
  return Chromium.executablePath();
}

module.exports = bootstrap;
