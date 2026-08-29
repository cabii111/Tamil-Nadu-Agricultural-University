const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  
  let filePath = path.join(__dirname, reqPath);
  
  // Try exact file, then with .html, then in scratch/, then by basename in scratch/
  const tryPaths = [
    filePath,
    filePath + '.html',
    path.join(__dirname, 'scratch', reqPath),
    path.join(__dirname, 'scratch', reqPath + '.html'),
    path.join(__dirname, 'scratch', path.basename(reqPath)),
    path.join(__dirname, 'scratch', path.basename(reqPath) + '.html')
  ];

  let resolvedPath = null;
  for (const p of tryPaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      resolvedPath = p;
      break;
    }
  }

  if (!resolvedPath) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }
  
  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(resolvedPath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Academic Redesign Server running at http://localhost:${PORT}/`);
});
