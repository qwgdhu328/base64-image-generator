const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  
  // Security: don't allow going above project dir
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    return res.end('403 Forbidden');
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: serve index.html for unknown routes
      fs.readFile(path.join(DIR, 'index.html'), (err2, fallback) => {
        if (err2) {
          res.writeHead(404);
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fallback);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  🚀 DevHub è online!');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log(`  │  👉 http://localhost:${PORT}                  │`);
  console.log('  │                                         │');
  console.log('  │  Premi Ctrl+C per fermare il server     │');
  console.log('  └─────────────────────────────────────────┘');
  console.log('');
});
