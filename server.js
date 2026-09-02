// 零依赖静态服务器：node server.js [port]
const http = require('http')
const https = require('https')
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

function aiEndpoint(baseUrl) {
  let u = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (/\/chat\/completions$/i.test(u)) return u
  return u + '/chat/completions'
}

function postJson(u, bodyObj, headers) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http
    const data = JSON.stringify(bodyObj)
    const req = lib.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, headers),
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function getJson(u, headers) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, headers || {}),
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.end()
  })
}

function streamProxy(u, bodyObj, headers, res) {
  const lib = u.protocol === 'https:' ? https : http
  const data = JSON.stringify(bodyObj)
  let finished = false
  const finish = () => { finished = true }
  const upstreamReq = lib.request({
    protocol: u.protocol,
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname + u.search,
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Accept': 'text/event-stream' }, headers),
  }, (upstream) => {
    if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
      const chunks = []
      upstream.on('data', (c) => chunks.push(c))
      upstream.on('end', () => {
        if (res.headersSent) { try { res.end() } catch {}; return }
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: '上游 ' + upstream.statusCode + ': ' + Buffer.concat(chunks).toString('utf8').slice(0, 250) }))
        finish()
      })
      return
    }
    res.writeHead(upstream.statusCode, { 'Content-Type': upstream.headers['content-type'] || 'text/event-stream', 'Cache-Control': 'no-cache' })
    upstream.pipe(res)
    upstream.on('end', () => { finish(); try { res.end() } catch {} })
    upstream.on('close', finish)
    upstream.on('error', () => { finish(); try { res.end() } catch {} })
  })
  upstreamReq.on('error', (e) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' })
    try { res.end(JSON.stringify({ ok: false, error: '代理请求失败: ' + e.message })) } catch {}
    finish()
  })
  res.on('close', () => { if (!finished) { try { upstreamReq.destroy() } catch {} } })
  upstreamReq.write(data)
  upstreamReq.end()
}

function getUrlRaw(target, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = target.protocol === 'https:' ? https : http
    const req = lib.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Referer': target.origin },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume()
        try { resolve(getUrlRaw(new URL(res.headers.location, target), redirects + 1)) } catch (e) { reject(e) }
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'] || 'application/octet-stream', buffer: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    req.end()
  })
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0])
  if (urlPath === '/' ) urlPath = '/index.html'
  if (urlPath === '/api/ai/design') {
    if (req.method !== 'POST') { res.writeHead(405); res.end('method not allowed'); return }
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', async () => {
      let cfg
      try { cfg = JSON.parse(body || '{}') } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'bad json' })); return }
      const baseUrl = cfg.baseUrl, apiKey = cfg.apiKey, model = cfg.model, messages = cfg.messages
      if (!baseUrl || !model || !Array.isArray(messages)) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '缺少 baseUrl / model / messages' })); return }
      let u
      try { u = new URL(aiEndpoint(baseUrl)) } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'baseUrl 无效' })); return }
      if (cfg.stream) {
        streamProxy(u, { model, messages }, { Authorization: 'Bearer ' + (apiKey || '') }, res)
        return
      }
      try {
        const r = await postJson(u, { model, messages }, { Authorization: 'Bearer ' + (apiKey || '') })
        if (r.status < 200 || r.status >= 300) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '上游 ' + r.status + ': ' + r.text.slice(0, 250) })); return }
        const j = JSON.parse(r.text)
        const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, content: typeof content === 'string' ? content : '' }))
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: '代理请求失败: ' + e.message }))
      }
    })
    return
  }


  if (urlPath === '/api/ai/models') {
    if (req.method !== 'POST') { res.writeHead(405); res.end('method not allowed'); return }
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', async () => {
      let cfg
      try { cfg = JSON.parse(body || '{}') } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'bad json' })); return }
      const baseUrl = cfg.baseUrl, apiKey = cfg.apiKey
      if (!baseUrl) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '缺少 baseUrl' })); return }
      let u
      try {
        let base = String(baseUrl).trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '')
        u = new URL(base + '/models')
      } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'baseUrl 无效' })); return }
      try {
        const r = await getJson(u, { Authorization: 'Bearer ' + (apiKey || '') })
        if (r.status < 200 || r.status >= 300) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '上游 ' + r.status + ': ' + r.text.slice(0, 200) })); return }
        let j
        try { j = JSON.parse(r.text) } catch { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '上游返回非 JSON' })); return }
        const data = Array.isArray(j && j.data) ? j.data.map((m) => (typeof m === 'string' ? m : (m && m.id) || '')).filter(Boolean) : []
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, data }))
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: '代理请求失败: ' + e.message }))
      }
    })
    return
  }

  if (urlPath === '/api/img/search') {
    if (req.method !== 'GET') { res.writeHead(405); res.end('method not allowed'); return }
    const qu = new URL(req.url, 'http://localhost')
    const id = qu.searchParams.get('id'), key = qu.searchParams.get('key'), words = qu.searchParams.get('words'), page = qu.searchParams.get('page') || '1'
    if (!id || !key || !words) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '缺少 id / key / words' })); return }
    const target = new URL('https://cn.apihz.cn/api/img/apihzimgbaidu.php')
    target.searchParams.set('id', id)
    target.searchParams.set('key', key)
    target.searchParams.set('limit', '10')
    target.searchParams.set('page', page)
    target.searchParams.set('words', words)
    ;(async () => {
      try {
        const r = await getUrlRaw(target)
        if (r.status < 200 || r.status >= 300) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '上游 ' + r.status })); return }
        res.writeHead(200, { 'Content-Type': r.contentType, 'Cache-Control': 'no-cache' })
        res.end(r.buffer)
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '搜索请求失败: ' + e.message }))
      }
    })()
    return
  }

  if (urlPath === '/api/img/proxy') {
    if (req.method !== 'GET') { res.writeHead(405); res.end('method not allowed'); return }
    const qu = new URL(req.url, 'http://localhost')
    const imgUrl = qu.searchParams.get('url')
    if (!imgUrl) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '缺少 url' })); return }
    let target
    try { target = new URL(imgUrl) } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'url 无效' })); return }
    if (!/^https?:/i.test(target.protocol)) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '仅支持 http/https' })); return }
    ;(async () => {
      try {
        const r = await getUrlRaw(target)
        if (r.status < 200 || r.status >= 300) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '上游 ' + r.status })); return }
        res.writeHead(200, { 'Content-Type': r.contentType, 'Cache-Control': 'no-cache' })
        res.end(r.buffer)
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '图片请求失败: ' + e.message }))
      }
    })()
    return
  }

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
