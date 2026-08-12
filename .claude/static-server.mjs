import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

const root = process.cwd();
const port = process.env.PORT || 3334;
const types = {
  '.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.json':'application/json','.svg':'image/svg+xml','.png':'image/png',
  '.jpg':'image/jpeg','.ico':'image/x-icon','.webmanifest':'application/manifest+json',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '') p = '/index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`static server on http://localhost:${port}`));
