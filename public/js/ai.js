// ai.js — AI 设计：提示词构造、OpenAI 兼容调用、JSON 解析与归一化
export const AI_CONFIG_KEY = 'sgsAiConfig'
export const MAX_AI_SKILLS = 3
export const MIN_AI_SKILLS = 1
export const MAX_AI_HP = 10
export const MIN_AI_HP = 1
export const MAX_DESC_CHARS = 300

const CAMP_MAP = {
  '魏': 'wei', '蜀': 'shu', '吴': 'wu', '群': 'qun', '晋': 'jin',
  'wei': 'wei', 'shu': 'shu', 'wu': 'wu', 'qun': 'qun', 'jin': 'jin',
}

export function loadConfig() {
  try { return JSON.parse(localStorage.getItem(AI_CONFIG_KEY)) || {} } catch { return {} }
}

export function saveConfig(cfg) {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(cfg || {}))
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
  try { return JSON.parse(t.slice(start, end + 1)) }
  catch { throw new Error('JSON 解析失败') }
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

