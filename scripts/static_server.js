/**
 * Minimal static file server for the browser-based verification scripts.
 *
 * The browser tooling (browser_tests.js, ui_audit.js, qa_all.js) needs the app
 * served over http:// rather than file:// (service worker registration, module
 * and fetch semantics). Previously each script hard-coded
 * http://127.0.0.1:8080 and silently assumed somebody had already started a
 * server there — so `npm run test:browser` failed with ERR_CONNECTION_REFUSED
 * on a clean checkout and in CI.
 *
 * This helper starts a throwaway server on an ephemeral port rooted at the
 * repository, and returns { origin, close } so callers are self-contained.
 *
 * Set CQ_TEST_ORIGIN to reuse an already-running server instead.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** Strip the query/fragment and percent-decode a request target. */
function decodeTarget(urlPath) {
  try {
    return decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
}

async function startStaticServer() {
  if (process.env.CQ_TEST_ORIGIN) {
    return { origin: process.env.CQ_TEST_ORIGIN.replace(/\/$/, ''), close: async () => {} };
  }

  const server = http.createServer((req, res) => {
    let target = decodeTarget(req.url || '/');
    if (target === null) {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (target.endsWith('/')) target += 'index.html';

    // Resolve, then require containment inside ROOT before any fs use.
    // Kept inline (rather than in a helper) so the check is unambiguously
    // a barrier on this data flow for static analysis and for readers.
    const resolved = path.resolve(ROOT, '.' + path.posix.normalize(target));
    if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    // Re-derive the path from a ROOT-relative segment so the value reaching
    // fs is built from ROOT plus a verified-internal relative path.
    const rel = path.relative(ROOT, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const file = path.join(ROOT, rel);

    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = startStaticServer;
