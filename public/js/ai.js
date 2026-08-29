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

export function buildPrompt(character) {
  const sys = '你是三国杀卡牌设计师，只输出符合要求的 JSON，不要任何前言、解释、markdown 或额外说明。'
  const user = [
    `请设计${character}的三国杀DIY武将。`,
    '约束条件：',
    '1. 输出JSON必须包含字段：人物名称、称号、势力、勾玉数（体力值）；技能数量不超过3个。',
    '2. 每个技能名称严格为两个汉字；全部技能描述合计总字数不超过300字。',
    '3. 参考人物原作百科设定，技能贴合人物能力；技能文本严格遵循三国杀官方技能表述规范，使用官方术语（锁定技、限定技、出牌阶段限一次、当XX时等），对标官方原版武将格式。',
    '4. 参考三国杀官方现有武将卡牌的设计逻辑与措辞。',
    '5. 势力只能从 魏 / 蜀 / 吴 / 群 / 晋 中五选一。',
    '6. 只输出标准JSON，不要任何前言、解释、markdown、额外说明文字。',
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

function extractContent(json) {
  const c = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content
  if (typeof c !== 'string') throw new Error('AI 响应缺少 content')
  return c
}

function isLocalhost() {
  return ['localhost', '127.0.0.1', '::1'].includes(location.hostname)
}

async function proxyRequest(cfg, messages) {
  const res = await fetch('/api/ai/design', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...cfg, messages }),
  })
  const pj = await res.json().catch(() => null)
  if (res.ok && pj && pj.ok) return pj.content
  throw new Error((pj && pj.error) || '本地代理调用失败')
}

export async function requestModel(cfg, messages) {
  const payload = JSON.stringify({ model: cfg.model, messages })
  const url = endpoint(cfg.baseUrl)
  const headers = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey

  let res
  try {
    res = await fetch(url, { method: 'POST', headers, body: payload })
  } catch (e) {
    if (isLocalhost()) return proxyRequest(cfg, messages)
    throw new Error('无法连接 AI 接口（网络或跨域限制）：' + e.message)
  }

  if (!res.ok) {
    let msg = 'HTTP ' + res.status
    try { const t = await res.text(); if (t) msg = t.slice(0, 300) } catch {}
    throw new Error('AI 接口错误：' + msg)
  }

  return extractContent(await res.json())
}

export async function generateCard({ character, cfg }) {
  if (!character) throw new Error('请输入人物名')
  if (!cfg || !cfg.baseUrl) throw new Error('请先配置 API 地址')
  if (!cfg.model) throw new Error('请先配置模型名')
  const messages = buildPrompt(character)
  const content = await requestModel(cfg, messages)
  const raw = extractJSON(content)
  return normalizeResult(raw, character)
}
