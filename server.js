// 零依赖静态服务器：node server.js [port]
const http = require('http')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, 'public')
const port = Number(process.argv[2]) || 5173

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0])
  if (urlPath === '/' ) urlPath = '/index.html'
  let file = path.normalize(path.join(root, urlPath))
  if (!file.startsWith(root)) {
    res.writeHead(403); res.end('forbidden'); return
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404); res.end('not found'); return
    }
    const ext = path.extname(file).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
}).listen(port, () => {
  console.log(`SGS DIY running at http://localhost:${port}`)
})
