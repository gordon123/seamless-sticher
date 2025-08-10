const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const server = http.createServer((req, res) => {
  const filePath = path.join(root, req.url === '/' ? '/index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const type = ext === '.html' ? 'text/html'
      : ext === '.js' || ext === '.jsx' ? 'text/javascript'
      : ext === '.json' ? 'application/json'
      : ext === '.css' ? 'text/css'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

const PORT = process.env.PORT || 5173;

server.listen(PORT, () => {
  console.log(`Seamless Stitcher dev server running at http://localhost:${PORT}`);
});
