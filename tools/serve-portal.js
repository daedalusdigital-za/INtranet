// Serves the prebuilt client portal (dist) and proxies /api/* to the logistics backend.
// Usage: node tools\serve-portal.js [distDir] [port] [backend]
const http = require('http');
const fs = require('fs');
const path = require('path');

const dist = process.argv[2] || '\\\\SAGE-SVR\\Users\\Administrator\\Desktop\\client-portal 2\\dist\\client-portal\\browser';
const port = parseInt(process.argv[3] || '4400', 10);
const backend = new URL(process.argv[4] || 'http://localhost:5143');

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const opts = { hostname: backend.hostname, port: backend.port, path: req.url, method: req.method, headers: { ...req.headers, host: backend.host } };
    const p = http.request(opts, up => { res.writeHead(up.statusCode, up.headers); up.pipe(res); });
    p.on('error', e => { res.writeHead(502); res.end('backend unavailable: ' + e.message); });
    req.pipe(p);
    return;
  }
  let rel = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(dist, rel);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-store, max-age=0', 'Pragma': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '0.0.0.0', () => console.log(`portal on http://0.0.0.0:${port} -> ${backend.origin}`));
