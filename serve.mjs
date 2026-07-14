import { createServer } from 'http';
import { readFileSync } from 'fs';

createServer((req, res) => {
  const html = readFileSync('app.html');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>');
}).listen(8734, () => console.log('servindo em http://localhost:8734'));
