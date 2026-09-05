// random.js — 随机抽取：预设存储、拼音排序与抽取算法
export const RND_PRESETS_KEY = 'sgsRandomPresets'
export const RND_MAX_WEIGHT = 99
export const RND_MIN_WEIGHT = 1
export const RND_MAX_ENTRIES = 99
export const RND_MAX_COUNT = 9999
export const RND_DEFAULT_PRESET = '全点数花色'

const zhCollator = new Intl.Collator('zh', { numeric: true, sensitivity: 'base' })

export function ensureDefaultPreset() {
  if (localStorage.getItem(RND_PRESETS_KEY) != null) return
  const suits = ['红桃', '方块', '梅花', '黑桃']
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  const entries = []
  for (const suit of suits) {
    for (const rank of ranks) {
      entries.push(makeEntry(suit + rank, 1))
    }
  }
  savePreset(RND_DEFAULT_PRESET, entries)
}

export function loadPresets() {
  try { return JSON.parse(localStorage.getItem(RND_PRESETS_KEY)) || {} } catch { return {} }
}

export function savePresets(presets) {
  localStorage.setItem(RND_PRESETS_KEY, JSON.stringify(presets || {}))
}

export function getPreset(name) {
  const presets = loadPresets()
  return presets[name] || null
}

// 保存（同名覆盖）
export function savePreset(name, entries) {
  const presets = loadPresets()
  presets[name] = {
    name,
    entries: (entries || []).map((e) => ({ id: e.id, name: e.name, weight: clampWeight(e.weight) })),
  }
  savePresets(presets)
}

export function removePreset(name) {
  const presets = loadPresets()
  if (!(name in presets)) return
  delete presets[name]
  savePresets(presets)
}

export function clampWeight(w) {
  let n = parseInt(w, 10)
  if (isNaN(n)) return RND_MIN_WEIGHT
  if (n < RND_MIN_WEIGHT) return RND_MIN_WEIGHT
  if (n > RND_MAX_WEIGHT) return RND_MAX_WEIGHT
  return n
}

export function compareText(a, b) {
  return zhCollator.compare(String(a), String(b))
}

export function sortEntries(entries) {
  return (entries || []).slice().sort((a, b) => compareText(a.name, b.name))
}

export function makeEntry(name, weight = 1) {
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
    name: String(name || ''),
    weight: clampWeight(weight),
  }
}

function buildPool(entries) {
  const pool = []
  for (const e of entries) {
    const w = clampWeight(e.weight)
    for (let i = 0; i < w; i++) pool.push(e)
  }
  return pool
}

// 抽取：放回（默认）每次独立；不放回则按权重份数从池中扣减
export function drawEntries(entries, count, withoutReplacement) {
  const list = entries || []
  const n = parseInt(count, 10)
  const target = isNaN(n) ? 1 : Math.max(1, n)
  if (!list.length) return []
  if (!withoutReplacement) {
    const pool = buildPool(list)
    const out = []
    for (let i = 0; i < target; i++) out.push(pool[Math.floor(Math.random() * pool.length)])
    return out
  }
  let pool = buildPool(list)
  const out = []
  const limit = Math.min(target, pool.length)
  for (let i = 0; i < limit; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool[idx])
    pool.splice(idx, 1)
  }
  return out
}
