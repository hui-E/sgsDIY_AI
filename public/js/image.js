// image.js — 图像服务：搜索、取图、URL 容错、浏览器/原生双通道
const IMG_API = 'https://cn.apihz.cn/api/img/apihzimgbaidu.php'

export function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
}

export function parseImageUrls(res) {
  const list = Array.isArray(res) ? res : []
  const out = []
  for (const item of list) {
    let u = String(item || '').trim()
    if (!u) continue
    const m = u.match(/\[[^\]]*\]\(([^)]+)\)/)
    if (m) u = m[1]
    u = u.split('\\&').join('&').replace(/&amp;/g, '&').replace(/\\u0026/gi, '&').trim()
    if (!/^https?:\/\//i.test(u)) continue
    out.push(u)
  }
  return out
}

function nativeHttp() {
  if (window.CapacitorHttp && window.CapacitorHttp.request) return window.CapacitorHttp
  if (window.Capacitor && window.Capacitor.Http && window.Capacitor.Http.request) return window.Capacitor.Http
  return null
}

async function nativeGetJson(url) {
  const http = nativeHttp()
  if (http) {
    const r = await http.request({ url, method: 'GET', responseType: 'json' })
    if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status)
    return r.data
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

async function nativeGetBlob(url) {
  const http = nativeHttp()
  if (http) {
    const r = await http.request({ url, method: 'GET', responseType: 'arraybuffer' })
    if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status)
    const d = r.data
    if (d instanceof ArrayBuffer) return new Blob([d])
    if (d instanceof Blob) return d
    if (typeof d === 'string') {
      const b64 = d.split(',')[1] || d
      const bin = atob(b64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      return new Blob([arr])
    }
    throw new Error('无法解析图片数据')
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.blob()
}

function buildSearchUrl(cfg, words, page) {
  const u = new URL(IMG_API)
  u.searchParams.set('id', cfg.imgId || '')
  u.searchParams.set('key', cfg.imgKey || '')
  u.searchParams.set('limit', '10')
  u.searchParams.set('page', String(page))
  u.searchParams.set('words', words)
  return u.toString()
}

export async function searchImages(cfg, words, page = 1) {
  if (!cfg || !cfg.imgId || !cfg.imgKey) throw new Error('未配置图像服务')
  const kw = String(words || '').trim()
  let raw
  if (isNative()) {
    raw = await nativeGetJson(buildSearchUrl(cfg, kw, page))
  } else {
    const u = new URL('/api/img/search', location.origin)
    u.searchParams.set('id', cfg.imgId)
    u.searchParams.set('key', cfg.imgKey)
    u.searchParams.set('words', kw)
    u.searchParams.set('page', String(page))
    const res = await fetch(u.toString())
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error('搜索失败：' + (t || res.status))
    }
    raw = await res.json()
  }
  const urls = parseImageUrls(raw && raw.res)
  const pageN = parseInt(raw && raw.page, 10) || page
  const maxpage = parseInt(raw && raw.maxpage, 10) || 1
  const count = parseInt(raw && raw.count, 10) || urls.length
  return { urls, page: pageN, maxpage, count }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e instanceof Error ? e : new Error('图片解码失败'))
    img.src = src
  })
}

export async function loadImageFromUrl(url) {
  let blob
  if (isNative()) {
    blob = await nativeGetBlob(url)
  } else {
    const u = new URL('/api/img/proxy', location.origin)
    u.searchParams.set('url', url)
    const res = await fetch(u.toString())
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error('图片加载失败：' + (t || res.status))
    }
    blob = await res.blob()
  }
  if (!blob) throw new Error('图片数据为空')
  const src = URL.createObjectURL(blob)
  const img = await loadImage(src)
  return { img, src }
}
