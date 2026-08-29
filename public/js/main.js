import {
  FACTIONS, FACTION_LABEL, MAX_HP, MIN_HP, MAX_SKILLS, MIN_SKILLS,
  CARD_W, CARD_H, defaultCard, coverTransform,
} from './data.js'
import { loadAssets } from './assets.js'
import { renderCard } from './render.js'
import { attachGestures } from './gestures.js'
import { renderPNG, downloadBlob, filenameFor, shareBlob } from './export.js'
import * as AI from './ai.js'

const $ = (s) => document.querySelector(s)

const state = {
  card: defaultCard(),
  tool: 'image',
  assets: null,
  canvas: $('#card'),
  ctx: $('#card').getContext('2d'),
  raf: 0,
  gestures: null,
}

const refs = {
  edit: $('#edit-view'),
  layout: $('#layout-view'),
  faction: $('#faction'),
  name: $('#name'),
  title: $('#title'),
  hp: $('#hp'),
  hpMinus: $('#hp-minus'),
  hpPlus: $('#hp-plus'),
  pickImage: $('#pick-image'),
  file: $('#file'),
  imageName: $('#image-name'),
  imagePreview: $('#image-preview'),
  skills: $('#skills'),
  skillCount: $('#skill-count'),
  addSkill: $('#add-skill'),
  next: $('#next'),
  back: $('#back'),
  save: $('#save'),
  tools: Array.from(document.querySelectorAll('.tool')),
  hint: $('#layout-hint'),
  toast: $('#toast'),
  aiOpen: $('#ai-open'),
  aiModal: $('#ai-modal'),
  aiClose: $('#ai-close'),
  aiCharacter: $('#ai-character'),
  aiBase: $('#ai-base'),
  aiKey: $('#ai-key'),
  aiModel: $('#ai-model'),
  aiSaveConfig: $('#ai-save-config'),
  aiGenerate: $('#ai-generate'),
  aiStatus: $('#ai-status'),
  aiProgress: $('#ai-progress'),
  aiStop: $('#ai-stop'),
  aiElapsed: $('#ai-elapsed'),
  aiTokens: $('#ai-tokens'),
  aiReasonBox: $('#ai-reason-box'),
  aiReasoning: $('#ai-reasoning'),
  aiStream: $('#ai-stream'),

}

let toastTimer = 0
function toast(msg) {
  refs.toast.textContent = msg
  refs.toast.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => refs.toast.classList.add('hidden'), 2200)
}

function requestRender() {
  if (state.raf) return
  state.raf = requestAnimationFrame(() => {
    state.raf = 0
    renderCard(state.ctx, state.card, state.assets)
  })
}

// ---------- 阶段一：编辑表单 ----------
function buildFactionGrid() {
  refs.faction.innerHTML = ''
  for (const f of FACTIONS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `faction-btn ${f}${state.card.faction === f ? ' active' : ''}`
    btn.textContent = FACTION_LABEL[f]
    btn.dataset.faction = f
    btn.addEventListener('click', () => {
      state.card.faction = f
      refs.faction.querySelectorAll('.faction-btn').forEach((b) => b.classList.toggle('active', b.dataset.faction === f))
    })
    refs.faction.appendChild(btn)
  }
}

function renderSkills() {
  refs.skills.innerHTML = ''
  state.card.skills.forEach((skill, i) => {
    const cardEl = document.createElement('div')
    cardEl.className = 'skill-card'

    const row = document.createElement('div')
    row.className = 'skill-row'
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.maxLength = 8
    nameInput.placeholder = `技能 ${i + 1} 名称`
    nameInput.value = skill.name
    nameInput.addEventListener('input', () => { skill.name = nameInput.value })

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'skill-del'
    delBtn.textContent = '×'
    delBtn.title = '删除技能'
    delBtn.disabled = state.card.skills.length <= MIN_SKILLS
    delBtn.addEventListener('click', () => removeSkill(i))

    row.appendChild(nameInput)
    row.appendChild(delBtn)

    const desc = document.createElement('textarea')
    desc.placeholder = `技能 ${i + 1} 描述`
    desc.value = skill.desc
    desc.addEventListener('input', () => { skill.desc = desc.value })

    cardEl.appendChild(row)
    cardEl.appendChild(desc)
    refs.skills.appendChild(cardEl)
  })
  refs.skillCount.textContent = `${state.card.skills.length} / ${MAX_SKILLS}`
  refs.addSkill.disabled = state.card.skills.length >= MAX_SKILLS
}

function addSkill() {
  if (state.card.skills.length >= MAX_SKILLS) return
  state.card.skills.push({ name: '', desc: '' })
  renderSkills()
}
function removeSkill(i) {
  if (state.card.skills.length <= MIN_SKILLS) return
  state.card.skills.splice(i, 1)
  renderSkills()
}

function clampHp(v) {
  let n = Number.parseInt(v, 10)
  if (Number.isNaN(n)) n = MIN_HP
  return Math.max(MIN_HP, Math.min(MAX_HP, n))
}
function setHp(v) {
  state.card.hp = clampHp(v)
  refs.hp.value = state.card.hp
}

function pickImage() {
  refs.file.click()
}

async function onFileChosen() {
  const file = refs.file.files && refs.file.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { toast('请选择图片文件'); return }
  const src = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    state.card.image = img
    state.card.imageSrc = src
    state.card.layout.image = coverTransform(img)
    refs.imageName.textContent = file.name
    refs.imagePreview.classList.remove('hidden')
    refs.imagePreview.style.backgroundImage = `url(${src})`
    refs.imagePreview.style.backgroundSize = 'cover'
    refs.imagePreview.style.backgroundPosition = 'center'
    requestRender()
  }
  img.onerror = () => toast('图片读取失败')
  img.src = src
}

// ---------- 阶段二：排版 ----------
function setTool(tool) {
  state.tool = tool
  refs.tools.forEach((b) => b.classList.toggle('active', b.dataset.tool === tool))
}

function goLayout() {
  if (!state.card.name.trim()) { toast('请填写武将名称'); return }
  if (!state.card.image) { toast('请先选择武将图片'); return }
  refs.edit.classList.add('hidden')
  refs.layout.classList.remove('hidden')
  requestRender()
}

function goEdit() {
  refs.layout.classList.add('hidden')
  refs.edit.classList.remove('hidden')
  refs.name.value = state.card.name
  refs.title.value = state.card.title
  refs.hp.value = state.card.hp
  buildFactionGrid()
  renderSkills()
}

async function save() {
  const blob = await renderPNG(state.card, state.assets)
  const filename = filenameFor(state.card)
  const shared = await shareBlob(blob, filename)
  if (!shared) downloadBlob(blob, filename)
  toast('已生成武将卡图片')
}

// ---------- AI 设计 ----------
let currentAIAbort = null
let aiElapsedTimer = 0
let aiElapsedSec = 0

function openAIModal() {
  const cfg = AI.loadConfig()
  refs.aiBase.value = cfg.baseUrl || ''
  refs.aiKey.value = cfg.apiKey || ''
  refs.aiModel.value = cfg.model || ''
  refs.aiStatus.textContent = ''
  refs.aiElapsed.textContent = '0s'
  refs.aiTokens.textContent = ''
  refs.aiStream.textContent = ''
  refs.aiReasoning.textContent = ''
  refs.aiReasonBox.classList.add('hidden')
  refs.aiReasonBox.open = false
  refs.aiProgress.classList.add('hidden')
  refs.aiModal.classList.remove('hidden')
}
function closeAIModal() {
  if (currentAIAbort) currentAIAbort.abort()
  refs.aiModal.classList.add('hidden')
}
function aiConfigFromForm() {
  return {
    baseUrl: refs.aiBase.value.trim(),
    apiKey: refs.aiKey.value.trim(),
    model: refs.aiModel.value.trim(),
  }
}
function saveConfigFromForm() {
  const cfg = aiConfigFromForm()
  if (!cfg.baseUrl) { refs.aiStatus.textContent = '请填写 API 地址'; toast('请填写 API 地址'); return }
  if (!cfg.model) { refs.aiStatus.textContent = '请填写模型名'; toast('请填写模型名'); return }
  AI.saveConfig(cfg)
  toast('配置已保存')
}
function startElapsed() {
  aiElapsedSec = 0
  refs.aiElapsed.textContent = '0s'
  clearInterval(aiElapsedTimer)
  aiElapsedTimer = setInterval(() => {
    aiElapsedSec++
    refs.aiElapsed.textContent = aiElapsedSec + 's'
    refs.aiStatus.textContent = '生成中… ' + aiElapsedSec + 's'
  }, 1000)
}
function stopElapsed() {
  clearInterval(aiElapsedTimer)
}
function stopAI() {
  if (currentAIAbort) currentAIAbort.abort()
}
function applyAIResult(r) {
  state.card.name = r.character_name
  state.card.title = r.title
  state.card.faction = r.camp
  state.card.hp = r.hp
  state.card.skills = r.skills.length ? r.skills.map((sk) => ({ name: sk.name, desc: sk.desc })) : [{ name: '', desc: '' }]
  refs.name.value = state.card.name
  refs.title.value = state.card.title
  refs.hp.value = state.card.hp
  buildFactionGrid()
  renderSkills()
  requestRender()
}
async function generateAI() {
  const character = refs.aiCharacter.value.trim()
  if (!character) { refs.aiStatus.textContent = '请输入人物名'; toast('请输入人物名'); return }
  const cfg = aiConfigFromForm()
  if (!cfg.baseUrl) { refs.aiStatus.textContent = '请填写 API 地址'; toast('请填写 API 地址'); return }
  if (!cfg.model) { refs.aiStatus.textContent = '请填写模型名'; toast('请填写模型名'); return }

  currentAIAbort = new AbortController()
  refs.aiGenerate.disabled = true
  refs.aiSaveConfig.disabled = true
  refs.aiStop.disabled = false
  refs.aiProgress.classList.remove('hidden')
  refs.aiStream.textContent = ''
  refs.aiReasoning.textContent = ''
  refs.aiReasonBox.classList.add('hidden')
  refs.aiReasonBox.open = false
  refs.aiTokens.textContent = ''
  startElapsed()

  try {
    AI.saveConfig(cfg)
    const r = await AI.streamCard({
      character, cfg, signal: currentAIAbort.signal,
      callbacks: {
        onReasoning: (chunk, full) => {
          refs.aiReasonBox.classList.remove('hidden')
          refs.aiReasonBox.open = true
          refs.aiReasoning.textContent = full
          refs.aiTokens.textContent = `已接收 ${full.length} 字`
        },
        onContent: (chunk, full) => {
          refs.aiStream.textContent = full
          refs.aiStream.scrollTop = refs.aiStream.scrollHeight
        },
      },
    })
    applyAIResult(r)
    refs.aiStatus.textContent = ''
    toast('已生成武将信息')
    closeAIModal()
  } catch (e) {
    const msg = (e && e.message) ? e.message : '未知错误'
    if (e && e.name === 'AbortError') {
      refs.aiStatus.textContent = '已停止'
      toast('已停止生成')
    } else {
      refs.aiStatus.textContent = msg
      toast('生成失败：' + msg)
    }
  } finally {
    stopElapsed()
    currentAIAbort = null
    refs.aiGenerate.disabled = false
    refs.aiSaveConfig.disabled = false
    refs.aiStop.disabled = true
    refs.aiProgress.classList.add('hidden')
  }
}


// ---------- 初始化 ----------
async function init() {
  state.assets = await loadAssets()

  buildFactionGrid()
  refs.name.value = state.card.name
  refs.title.value = state.card.title
  refs.hp.value = state.card.hp
  renderSkills()

  refs.name.addEventListener('input', () => { state.card.name = refs.name.value })
  refs.title.addEventListener('input', () => { state.card.title = refs.title.value })
  refs.hp.addEventListener('input', () => setHp(refs.hp.value))
  refs.hpMinus.addEventListener('click', () => setHp(state.card.hp - 1))
  refs.hpPlus.addEventListener('click', () => setHp(state.card.hp + 1))
  refs.addSkill.addEventListener('click', addSkill)
  refs.pickImage.addEventListener('click', pickImage)
  refs.file.addEventListener('change', onFileChosen)
  refs.next.addEventListener('click', goLayout)
  refs.back.addEventListener('click', goEdit)
  refs.save.addEventListener('click', save)
  refs.tools.forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)))
  refs.aiOpen.addEventListener('click', openAIModal)
  refs.aiClose.addEventListener('click', closeAIModal)
  refs.aiSaveConfig.addEventListener('click', saveConfigFromForm)
  refs.aiGenerate.addEventListener('click', generateAI)
  refs.aiStop.addEventListener('click', stopAI)

  refs.aiModal.addEventListener('click', (e) => { if (e.target.classList.contains('modal-mask')) closeAIModal() })

  state.gestures = attachGestures({
    canvas: state.canvas,
    getCard: () => state.card,
    onUpdate: requestRender,
    onTool: () => state.tool,
  })

  // 便于调试/截图
  window.__SGS__ = {
    state,
    requestRender,
    renderPNG: async () => renderPNG(state.card, state.assets),
    ai: AI,
  }

  // 演示模式：?demo — 用成品参考图作为武将图，直接进入排版，便于验证渲染
  if (new URLSearchParams(location.search).has('demo')) {
    const img = new Image()
    img.onload = () => {
      state.card.image = img
      state.card.imageSrc = 'assets/demo-portrait.jpg'
      state.card.layout.image = coverTransform(img)
      goLayout()
    }
    img.src = 'assets/demo-portrait.jpg'
    return
  }

  requestRender()
}

init()
