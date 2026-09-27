// server.js - שרת פיתוח לעִבְרִית עם טעינה-חוצה חיה

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { compileFile, finalize } from './compiler.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.iv': 'text/plain; charset=utf-8',
};

const RELOAD_SCRIPT = `<script>
(function () {
  var es = new EventSource('/__ivrit/watch');
  es.onmessage = function () { location.reload(); };
  es.onerror = function () { setTimeout(function(){ location.reload(); }, 1500); };
})();
</script>`;

export function build(file, options = {}) {
  const started = Date.now();
  const result = compileFile(file, options);
  return { ...result, ms: Date.now() - started };
}

function injectReload(html) {
  if (html.includes('</body>')) return html.replace('</body>', `${RELOAD_SCRIPT}\n</body>`);
  return html + RELOAD_SCRIPT;
}

export function serve({ file, port = 3000, design = true, minify = false, open = false }) {
  const clients = new Set();
  const root = path.dirname(file);

  const broadcast = (message) => {
    for (const res of clients) {
      try { res.write(`data: ${message}\n\n`); } catch { clients.delete(res); }
    }
  };

  let watcher = null;
  try {
    watcher = fs.watch(root, { recursive: false }, (_event, filename) => {
      if (!filename) return broadcast('change');
      const ext = path.extname(String(filename));
      if (['.iv', '.ivrit', '.css', '.html', '.js'].includes(ext)) broadcast('change');
    });
  } catch {
    console.warn('אזהרה: לא הצלחתי לעקוב אחרי הקבצים (אפשר לרענן ידנית)');
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/__ivrit/watch') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    if (pathname === '/index.html' || pathname.endsWith('.iv') === false) {
      // נסה לטעון קובץ סטטי לפני קומפילציה
    }

    const result = build(file, { design, collectErrors: true });
    const staticFile = path.join(root, pathname.replace(/^\/+/, ''));
    const isStatic = pathname !== '/index.html'
      && staticFile.startsWith(root)
      && fs.existsSync(staticFile)
      && fs.statSync(staticFile).isFile()
      && path.extname(staticFile) !== '.iv';

    if (isStatic) {
      const type = MIME[path.extname(staticFile).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      fs.createReadStream(staticFile).pipe(res);
      return;
    }

    if (result.errors.length) {
      const report = result.errors.map((e) => `<li><code>${escapeHtml(e.message)}</code></li>`).join('');
      res.writeHead(500, { 'Content-Type': MIME['.html'] });
      res.end(errorPage(result.errors, report));
      console.log(`✖ שגיאה: ${result.errors[0].message}`);
      return;
    }

    for (const warn of result.warnings) console.log(`⚠ ${warn.message}`);
    for (const line of result.output) console.log(`הדפס › ${line}`);

    const html = injectReload(finalize(result, { minify }));
    res.writeHead(200, {
      'Content-Type': MIME['.html'],
      'Cache-Control': 'no-store',
    });
    res.end(html);
    console.log(`↻ ${pathname} (${(Buffer.byteLength(html) / 1024).toFixed(1)}KB, ${result.ms}ms)`);
  });

  server.listen(port, () => {
    console.log(`\n  עִבְרִית פועלת על  ${bold(`http://localhost:${port}`)}`);
    console.log(`  עוקב אחרי: ${file}`);
    console.log(`  עצור עם Ctrl+C\n`);
    if (open) openBrowser(port);
  });

  const shutdown = () => {
    console.log('\nלהתראות 👋');
    if (watcher) watcher.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 300);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return server;
}

function bold(s) {
  return process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function errorPage(errors, report) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>שגיאה בקוד</title>
<style>
body{font-family:system-ui,"Rubik",sans-serif;background:#0f1117;color:#e6e6e6;padding:2rem;line-height:1.7}
h1{color:#f04438;margin-top:0}
li{margin:.5rem 0;list-style:none}
code{background:#1c2030;padding:.25rem .5rem;border-radius:6px;direction:ltr;display:inline-block}
</style></head>
<body>
<h1>יש שגיאות בקוד</h1>
<ul>${report}</ul>
<p>תקן את הקובץ והדפדפן יתעדכן אוטומטית.</p>
</body></html>`;
}

function openBrowser(port) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start' : 'xdg-open';
  import('node:child_process').then(({ exec }) => {
    exec(`${cmd} http://localhost:${port}`);
  }).catch(() => {});
}
