// ai.js — AI 设计：提示词构造、OpenAI 兼容调用、JSON 解析与归一化
export const AI_CONFIG_KEY = 'sgsAiConfig'
export const CURRENT_CONFIG_KEY = 'sgsCurrentConfig'
export const AI_PRESETS_KEY = 'sgsAiPresets'
export const AI_ACTIVE_KEY = 'sgsAiActivePreset'
export const IMG_CONFIG_KEY = 'sgsImgConfig'
export const AI_FIELDS = ['baseUrl', 'apiKey', 'model', 'designReq']
export const MAX_AI_SKILLS = 3
export const MIN_AI_SKILLS = 1
export const MAX_AI_HP = 10
export const MIN_AI_HP = 1
export const MAX_DESC_CHARS = 300

const CAMP_MAP = {
  '魏': 'wei', '蜀': 'shu', '吴': 'wu', '群': 'qun', '晋': 'jin',
  'wei': 'wei', 'shu': 'shu', 'wu': 'wu', 'qun': 'qun', 'jin': 'jin',
}

export function loadPresets() {
  try { return JSON.parse(localStorage.getItem(AI_PRESETS_KEY)) || {} } catch { return {} }
}

export function savePresets(presets) {
  localStorage.setItem(AI_PRESETS_KEY, JSON.stringify(presets || {}))
}

export function loadActiveName() {
  return localStorage.getItem(AI_ACTIVE_KEY) || ''
}

export function saveActiveName(name) {
  if (name) localStorage.setItem(AI_ACTIVE_KEY, String(name))
  else localStorage.removeItem(AI_ACTIVE_KEY)
}

export function loadConfig() {
  // 优先返回当前正在使用的配置（普通保存的目标）
  try {
    const cur = JSON.parse(localStorage.getItem(CURRENT_CONFIG_KEY)) || {}
    if (cur && (cur.baseUrl || cur.model)) return cur
  } catch {}
  const presets = loadPresets()
  const active = loadActiveName()
  if (active && presets[active]) return presets[active]
  // 兼容旧的单份配置
  try {
    const old = JSON.parse(localStorage.getItem(AI_CONFIG_KEY)) || {}
    if (old && (old.baseUrl || old.model)) return old
  } catch {}
  return {}
}

export function saveConfig(cfg) {
  // 普通保存：写入当前使用配置，不产生命名预设
  const clean = {}
  for (const k of AI_FIELDS) if (cfg && cfg[k] !== undefined) clean[k] = cfg[k]
  try { localStorage.setItem(CURRENT_CONFIG_KEY, JSON.stringify(clean)) } catch {}
  try { localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(clean)) } catch {}
}

export function saveAsPreset(name, cfg) {
  const presets = loadPresets()
  const clean = { name }
  for (const k of AI_FIELDS) if (cfg && cfg[k] !== undefined) clean[k] = cfg[k]
  presets[name] = clean
  savePresets(presets)
  saveActiveName(name)
  saveConfig(cfg)
}

export function removePreset(name) {
  const presets = loadPresets()
  if (!(name in presets)) return
  delete presets[name]
  savePresets(presets)
  if (loadActiveName() === name) saveActiveName('')
}

export function loadImgConfig() {
  try { return JSON.parse(localStorage.getItem(IMG_CONFIG_KEY)) || {} } catch { return {} }
}

export function saveImgConfig(cfg) {
  localStorage.setItem(IMG_CONFIG_KEY, JSON.stringify(cfg || {}))
}

export function buildPrompt(character, designReq = '') {
  const sys = '你是三国杀卡牌设计师，只输出符合要求的 JSON，不要任何前言、解释、markdown 或额外说明。'
  const user = [
    `请设计${character}的三国杀DIY武将。`,
    ...(designReq ? ['武将设计要求：', designReq] : []),
    '约束条件：',
    '1. 输出JSON必须包含字段：人物名称、称号、势力、勾玉数（体力值）；技能数量不超过3个。',
    '2. 每个技能名称严格为两个汉字；全部技能描述合计总字数不超过300字。',
    '3. 参考人物原作百科设定，技能贴合人物能力；',
    '4. 技能文本严格遵循三国杀官方技能表述规范，使用官方术语。',
    '5. 势力只能从 魏 / 蜀 / 吴 / 群 / 晋 中五选一。',
    '6. 只输出标准JSON，不要任何前言、解释、markdown、额外说明文字。',
    '7. 设计完仅检查一次，没问题就输出，禁止过度检查。',
    'JSON字段规范：',
    '{',
    '  "character_name": "人物名称",',
    '  "title": "人物称号",',
    '  "camp": "势力",',
    '  "hp": 勾玉数,',
    '  "skills": [',
    '    { "name": "两字技能名", "desc": "三国杀规范技能描述文本" }',
    '  ]',
    '}',
  ].join('\n')
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]
}

export function extractJSON(text) {
  if (typeof text !== 'string') throw new Error('AI 未返回文本内容')
  let t = text.trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('返回内容中未找到 JSON')
  return parseTolerant(t.slice(start, end + 1))
}

// 逐级容错：直接解析失败时做字符串感知修复，再尝试
function parseTolerant(body) {
  const candidates = [
    body,
    repairQuotes(body),
    stripTrailingCommas(repairQuotes(body)),
  ]
  for (const c of candidates) {
    try { return JSON.parse(c) } catch {}
  }
  throw new Error('JSON 解析失败')
}

// 字符串感知：把字符串内容里的裸英文双引号转义为 \"，不触碰合法定界符
function repairQuotes(s) {
  let out = ''
  let inStr = false
  let esc = false
  const structural = (ch) => ch === undefined || ch === ',' || ch === '}' || ch === ']' || ch === ':' || /\s/.test(ch)
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) { out += c; esc = false; continue }
      if (c === '\\') { out += c; esc = true; continue }
      if (c === '"') {
        if (structural(s[i + 1])) { out += '"'; inStr = false }
        else { out += '\\"' }
        continue
      }
      out += c
      continue
    }
    if (c === '"') { inStr = true; out += c; continue }
    out += c
  }
  return out
}

// 字符串感知：去掉数组/对象末尾的尾逗号
function stripTrailingCommas(s) {
  let out = ''
  let inStr = false
  let esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      out += c
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; out += c; continue }
    if (c === ',') {
      let j = i + 1
      while (j < s.length && /\s/.test(s[j])) j++
      if (s[j] === '}' || s[j] === ']') { continue }
    }
    out += c
  }
  return out
}

export function normalizeResult(raw, fallbackName = '') {
  const r = (raw && typeof raw === 'object') ? raw : {}
  const campRaw = String(r.camp || '').trim()
  const camp = CAMP_MAP[campRaw] || 'qun'

  let hp = Number.parseInt(r.hp, 10)
  if (Number.isNaN(hp)) hp = MIN_AI_HP
  hp = Math.max(MIN_AI_HP, Math.min(MAX_AI_HP, hp))

  const character_name = String(r.character_name || fallbackName || '').trim()
  const title = String(r.title || '').trim()

  let skills = Array.isArray(r.skills) ? r.skills.map((s) => ({
    name: String((s && s.name) || '').trim(),
    desc: String((s && s.desc) || '').trim(),
  })) : []
  skills = skills.filter((s) => s.name || s.desc)
  if (skills.length === 0) skills = [{ name: '', desc: '' }]
  if (skills.length > MAX_AI_SKILLS) skills = skills.slice(0, MAX_AI_SKILLS)
  skills = skills.map((s) => ({ ...s, name: s.name.length > 2 ? s.name.slice(0, 2) : s.name }))

  let total = skills.reduce((n, s) => n + [...s.desc].length, 0)
  if (total > MAX_DESC_CHARS) {
    let acc = MAX_DESC_CHARS
    const trimmed = []
    for (let i = skills.length - 1; i >= 0; i--) {
      const arr = [...skills[i].desc]
      let d = skills[i].desc
      if (acc < arr.length) { d = arr.slice(0, acc).join(''); acc = 0 }
      else { acc -= arr.length }
      trimmed.unshift({ ...skills[i], desc: d })
    }
    skills = trimmed
  }

  return { character_name, title, camp, hp, skills }
}

export function endpoint(baseUrl) {
  let u = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (/\/chat\/completions$/i.test(u)) return u
  return u + '/chat/completions'
}
function nativeHttp() {
  if (window.CapacitorHttp && window.CapacitorHttp.request) return window.CapacitorHttp
  if (window.Capacitor && window.Capacitor.Http && window.Capacitor.Http.request) return window.Capacitor.Http
  return null
}

export async function fetchModels(cfg) {
  if (!cfg || !cfg.baseUrl) throw new Error('请先填写 API 地址')
  const base = String(cfg.baseUrl).trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '')
  const url = base + '/models'
  if (isNative()) {
    const plugin = getNativePlugin()
    if (!plugin || typeof plugin.models !== 'function') throw new Error('原生 HTTP 插件未加载')
    const r = await plugin.models({ baseUrl: base, apiKey: cfg.apiKey || '' })
    const list = r && r.data
    return Array.isArray(list) ? list.map((m) => (typeof m === 'string' ? m : (m && m.id) || '')).filter(Boolean) : []
  }
  const res = await fetch('/api/ai/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey || '' }),
  })
  let j = null
  try { j = await res.json() } catch {}
  if (!res.ok || !j) throw new Error((j && j.error) || '获取模型列表失败')
  if (!j.ok) throw new Error(j.error || '获取模型列表失败')
  return Array.isArray(j.data) ? j.data : []
}


function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
}

function isLocalhost() {
  return ['localhost', '127.0.0.1', '::1'].includes(location.hostname)
}

async function consumeSSE(res, callbacks = {}, signal) {
  if (!res.body) throw new Error('响应不支持流式读取')
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  let content = ''
  let reasoning = ''
  while (true) {
    const { value, done } = await reader.read()
    if (signal && signal.aborted) {
      try { await reader.cancel() } catch {}
      const err = new Error('已停止生成')
      err.name = 'AbortError'
      throw err
    }
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '').trim()
      buf = buf.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') {
        try { await reader.cancel() } catch {}
        return { content, reasoning }
      }
      if (!data) continue
      let obj
      try { obj = JSON.parse(data) } catch { continue }
      const choice = obj.choices && obj.choices[0]
      const delta = choice && choice.delta
      if (!delta) continue
      if (typeof delta.reasoning_content === 'string') {
        reasoning += delta.reasoning_content
        if (callbacks.onReasoning) callbacks.onReasoning(delta.reasoning_content, reasoning)
      } else if (typeof delta.reasoning === 'string') {
        reasoning += delta.reasoning
        if (callbacks.onReasoning) callbacks.onReasoning(delta.reasoning, reasoning)
      }
      if (typeof delta.content === 'string') {
        content += delta.content
        if (callbacks.onContent) callbacks.onContent(delta.content, content)
      }
    }
  }
  return { content, reasoning }
}

async function proxyStream(cfg, messages, callbacks = {}, signal) {
  const res = await fetch('/api/ai/design', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...cfg, messages, stream: true }),
    signal,
  })
  if (!res.ok) {
    const pj = await res.json().catch(() => null)
    throw new Error((pj && pj.error) || '本地代理调用失败')
  }
  return consumeSSE(res, callbacks, signal)
}

let nativePlugin = null
function getNativePlugin() {
  if (nativePlugin) return nativePlugin
  if (window.Capacitor && window.Capacitor.registerPlugin) {
    nativePlugin = window.Capacitor.registerPlugin('AiStream')
  } else if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AiStream) {
    nativePlugin = window.Capacitor.Plugins.AiStream
  }
  if (!nativePlugin) throw new Error('原生流式桥接插件未加载')
  return nativePlugin
}

let nativeSeq = 0
function nativeStream(cfg, messages, callbacks = {}, signal) {
  return new Promise((resolve, reject) => {
    const requestId = 'sgs-' + (++nativeSeq) + '-' + Date.now()
    let plugin
    try { plugin = getNativePlugin() } catch (e) { reject(e); return }
    try { if (plugin && typeof plugin.setKeepScreenOn === 'function') plugin.setKeepScreenOn({ keepScreenOn: true }) } catch (e) {}

    let reasoning = ''
    let content = ''
    let settled = false
    let aborted = false
    const listeners = []

    const cleanupAll = () => {
      listeners.forEach((l) => { try { l && l.remove && l.remove() } catch {} })
      if (signal) signal.removeEventListener('abort', onAbort)
      try { if (plugin && typeof plugin.setKeepScreenOn === 'function') plugin.setKeepScreenOn({ keepScreenOn: false }) } catch (e) {}
    }

    const onAbort = () => {
      aborted = true
      try { plugin.stop({ requestId }) } catch {}
    }

    const done = (ev) => {
      if (settled || ev.requestId !== requestId) return
      settled = true
      cleanupAll()
      if (ev.cancelled && aborted) {
        const err = new Error('已停止生成')
        err.name = 'AbortError'
        reject(err)
      } else {
        resolve({ content, reasoning })
      }
    }

    const fail = (ev) => {
      if (settled || ev.requestId !== requestId) return
      settled = true
      cleanupAll()
      reject(new Error(ev.error || '原生流式调用失败'))
    }

    const onReasoning = (ev) => {
      if (settled || ev.requestId !== requestId) return
      reasoning += ev.chunk || ''
      if (callbacks.onReasoning) callbacks.onReasoning(ev.chunk || '', reasoning)
    }
    const onContent = (ev) => {
      if (settled || ev.requestId !== requestId) return
      content += ev.chunk || ''
      if (callbacks.onContent) callbacks.onContent(ev.chunk || '', content)
    }

    try {
      listeners.push(plugin.addListener('done', done))
      listeners.push(plugin.addListener('error', fail))
      listeners.push(plugin.addListener('reasoning', onReasoning))
      listeners.push(plugin.addListener('content', onContent))
    } catch (e) {
      settled = true
      reject(new Error('原生流式监听注册失败：' + (e && e.message ? e.message : e)))
      return
    }

    if (signal) {
      if (signal.aborted) { onAbort(); done({ requestId, cancelled: true }); return }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    const payload = JSON.stringify({ model: cfg.model, messages, stream: true })
    const url = endpoint(cfg.baseUrl).replace(/\/+$/, '')
    try {
      plugin.stream({ requestId, baseUrl: url, apiKey: cfg.apiKey || '', model: cfg.model, payload })
    } catch (e) {
      settled = true
      cleanupAll()
      reject(new Error('原生流式调用失败：' + (e && e.message ? e.message : e)))
    }
  })
}

export async function requestModelStream(cfg, messages, callbacks = {}, signal) {
  if (isNative()) return nativeStream(cfg, messages, callbacks, signal)

  const payload = JSON.stringify({ model: cfg.model, messages, stream: true })
  const url = endpoint(cfg.baseUrl)
  const headers = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey

  let res
  try {
    res = await fetch(url, { method: 'POST', headers, body: payload, signal })
  } catch (e) {
    if (signal && signal.aborted) throw e
    if (isLocalhost()) return proxyStream(cfg, messages, callbacks, signal)
    throw new Error('无法连接 AI 接口（网络或跨域限制）：' + e.message)
  }

  if (!res.ok) {
    let msg = 'HTTP ' + res.status
    try { const t = await res.text(); if (t) msg = t.slice(0, 300) } catch {}
    throw new Error('AI 接口错误：' + msg)
  }

  return consumeSSE(res, callbacks, signal)
}

export async function streamCard({ character, cfg, callbacks = {}, signal }) {
  if (!character) throw new Error('请输入人物名')
  if (!cfg || !cfg.baseUrl) throw new Error('请先配置 API 地址')
  if (!cfg.model) throw new Error('请先配置模型名')
  const messages = buildPrompt(character, cfg.designReq || '')
  const { content } = await requestModelStream(cfg, messages, callbacks, signal)
  const raw = extractJSON(content)
  return normalizeResult(raw, character)
}

