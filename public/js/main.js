import {
  FACTIONS, FACTION_LABEL, MAX_HP, MIN_HP, MAX_SKILLS, MIN_SKILLS,
  CARD_W, CARD_H, defaultCard, coverTransform,
} from './data.js'
import { loadAssets } from './assets.js'
import { renderCard } from './render.js'
import { attachGestures } from './gestures.js'
import { renderPNG, renderCardImage, baseNameFor, downloadBlob, filenameFor, shareBlob } from './export.js'
import * as AI from './ai.js'
import { searchImages, loadImageFromUrl, isNative } from './image.js'

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
  aiConfigOpen: $('#ai-config-open'),
  genView: $('#generate-view'),
  genBack: $('#gen-back'),
  cfgView: $('#config-view'),
  cfgBack: $('#cfg-back'),
  cfgStatus: $('#cfg-status'),
  aiCharacter: $('#ai-character'),
  aiBase: $('#ai-base'),
  aiKey: $('#ai-key'),
  aiModel: $('#ai-model'),
  aiDesign: $('#ai-design'),
  aiSaveConfig: $('#ai-save-config'),
  aiGenerate: $('#ai-generate'),
  aiStatus: $('#ai-status'),
  aiProgress: $('#ai-progress'),
  aiStop: $('#ai-stop'),
  aiElapsed: $('#ai-elapsed'),
  aiTokens: $('#ai-tokens'),
  aiCurrent: $('#ai-current'),
  aiFollow: $('#ai-follow'),
  aiContentBox: $('#ai-content-box'),
  aiStream: $('#ai-stream'),
  imgSwap: $('#img-swap'),
  aiImgId: $('#ai-img-id'),
  aiImgKey: $('#ai-img-key'),

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


// ---------- 原生插件辅助 ----------
function capPlugin(name) {
  if (window.Capacitor && window.Capacitor.registerPlugin) return window.Capacitor.registerPlugin(name)
  if (window.Capacitor && window.Capacitor.Plugins) return window.Capacitor.Plugins[name]
  return null
}


const CameraSourceValue = { Photos: 'PHOTOS', Camera: 'CAMERA', Prompt: 'PROMPT' }
const CameraResultTypeValue = { Uri: 'uri', Base64: 'base64', DataUrl: 'dataUrl' }

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = () => reject(new Error('图片转换失败'))
    fr.readAsDataURL(blob)
  })
}
function applyImageToCard(img, src, label) {
  const old = state.card.imageSrc
  state.card.image = img
  state.card.imageSrc = src
  state.card.layout.image = coverTransform(img)
  if (old && old.startsWith('blob:')) URL.revokeObjectURL(old)
  refs.imageName.textContent = label
  refs.imgSwap.classList.add('hidden')
  refs.imagePreview.classList.remove('hidden')
  refs.imagePreview.style.backgroundImage = `url(${src})`
  refs.imagePreview.style.backgroundSize = 'cover'
  refs.imagePreview.style.backgroundPosition = 'center'
  requestRender()
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
  if (isNative()) {
    const Camera = capPlugin('Camera')
    if (!Camera || !Camera.getPhoto) { toast('相机插件未加载'); return }
    Camera.getPhoto({ source: CameraSourceValue.Photos, resultType: CameraResultTypeValue.Uri, quality: 92, correctOrientation: true })
      .then((photo) => {
        const src = photo.webPath || photo.path
        if (!src) { toast('未获取到图片'); return }
        const img = new Image()
        img.onload = () => applyImageToCard(img, src, '相册图片')
        img.onerror = () => toast('图片读取失败')
        img.src = src
      })
      .catch((e) => toast('选择图片失败：' + ((e && e.message) || '已取消')))
    return
  }
  refs.file.click()
}

async function onFileChosen() {
  const file = refs.file.files && refs.file.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { toast('请选择图片文件'); return }
  const src = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => applyImageToCard(img, src, file.name)
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

async function nextAlbumName(albumDir, base) {
  let plugin = null
  try {
    if (window.Capacitor && window.Capacitor.registerPlugin) plugin = window.Capacitor.registerPlugin('AlbumTools')
    else if (window.Capacitor && window.Capacitor.Plugins) plugin = window.Capacitor.Plugins.AlbumTools
  } catch (e) {}
  if (plugin && typeof plugin.nextFileName === 'function') {
    try {
      const r = await plugin.nextFileName({ albumDir, baseName: base })
      if (r && r.name) return r.name
    } catch (e) {}
  }
  return base + '_' + Date.now()
}

async function save() {
  const blob = await renderCardImage(state.card, state.assets, 'image/jpeg', 0.92)
  const base = baseNameFor(state.card)
  if (isNative()) {
    const Media = capPlugin('Media')
    if (!Media || !Media.savePhoto) { toast('相册插件未加载'); return }
    const albumDir = await resolveAlbum(Media)
    const fileName = await nextAlbumName(albumDir, base)
    const dataUrl = await blobToDataUrl(blob)
    try {
      await Media.savePhoto({ path: dataUrl, fileName, albumIdentifier: albumDir })
      toast('已保存到相册')
    } catch (e) {
      toast('保存失败：' + ((e && e.message) || '未知错误'))
    }
    return
  }
  const filename = filenameFor(state.card, 'jpg')
  const shared = await shareBlob(blob, filename, 'image/jpeg')
  if (!shared) downloadBlob(blob, filename)
  toast('已生成武将卡图片')
}

// ---------- AI 设计 ----------
let currentAIAbort = null
let aiElapsedTimer = 0
let aiElapsedSec = 0

let aiFollowReasoning = true
let aiPhase = '思考中'

function throttleTail(fn, minMs) {
  let lastTs = 0, timer = 0, latestArgs = null
  const invoke = () => { timer = 0; lastTs = Date.now(); fn(...latestArgs) }
  const wrapped = (...args) => {
    latestArgs = args
    const now = Date.now()
    const wait = minMs - (now - lastTs)
    if (wait <= 0) { if (timer) clearTimeout(timer); timer = 0; lastTs = now; fn(...args) }
    else if (!timer) timer = setTimeout(invoke, wait)
  }
  wrapped.cancel = () => { if (timer) clearTimeout(timer); timer = 0; latestArgs = null }
  return wrapped
}

function summarizeStream(text) {
  const t = text || ''
  const campM = t.match(/"camp"\s*[:：]\s*"?([^"',\s{}]+)/i)
  const hpM = t.match(/"hp"\s*[:：]\s*"?(\d+)/i)
  const nameM = t.match(/"name"\s*[:：]/g)
  const parts = []
  if (campM) parts.push('势力 ' + campM[1])
  if (hpM) parts.push('体力 ' + hpM[1])
  if (nameM) parts.push('技能 ' + nameM.length)
  return parts.length ? '生成中 · ' + parts.join(' · ') : '生成中 · 正在排版武将信息…'
}

const renderReasoning = (full) => {
  refs.aiCurrent.textContent = full || ''
  refs.aiCurrent.classList.remove('hidden')
  if (aiFollowReasoning) refs.aiCurrent.scrollTop = refs.aiCurrent.scrollHeight
  else refs.aiFollow.classList.remove('hidden')
}

const renderContent = throttleTail((full) => {
  refs.aiCurrent.textContent = summarizeStream(full)
  refs.aiCurrent.classList.remove('hidden')
}, 160)

function attachAIFollow() {
  refs.aiCurrent.addEventListener('scroll', () => {
    const el = refs.aiCurrent
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32
    aiFollowReasoning = nearBottom
    refs.aiFollow.classList.toggle('hidden', nearBottom)
  })
  refs.aiFollow.addEventListener('click', () => {
    aiFollowReasoning = true
    refs.aiCurrent.scrollTop = refs.aiCurrent.scrollHeight
    refs.aiFollow.classList.add('hidden')
  })
}

function resetAIView() {
  refs.aiStatus.textContent = ''
  refs.aiElapsed.textContent = '0s'
  refs.aiTokens.textContent = ''
  refs.aiStream.textContent = ''
  refs.aiCurrent.textContent = ''
  refs.aiCurrent.classList.add('hidden')
  refs.aiContentBox.classList.add('hidden')
  refs.aiContentBox.open = false
  refs.aiProgress.classList.add('hidden')
  refs.aiFollow.classList.add('hidden')
  renderContent.cancel()
  aiFollowReasoning = true
  aiPhase = '思考中'
}
function goGenerate() {
  refs.edit.classList.add('hidden')
  refs.genView.classList.remove('hidden')
  const cfg = AI.loadConfig()
  refs.aiBase.value = cfg.baseUrl || ''
  refs.aiKey.value = cfg.apiKey || ''
  refs.aiModel.value = cfg.model || ''
  refs.aiDesign.value = cfg.designReq || ''
  refs.aiImgId.value = cfg.imgId || ''
  refs.aiImgKey.value = cfg.imgKey || ''
  resetAIView()
}
function goGenerateBack() {
  if (currentAIAbort) currentAIAbort.abort()
  refs.genView.classList.add('hidden')
  refs.edit.classList.remove('hidden')
}
function goConfig() {
  refs.edit.classList.add('hidden')
  refs.cfgView.classList.remove('hidden')
  const cfg = AI.loadConfig()
  refs.aiBase.value = cfg.baseUrl || ''
  refs.aiKey.value = cfg.apiKey || ''
  refs.aiModel.value = cfg.model || ''
  refs.aiDesign.value = cfg.designReq || ''
  refs.aiImgId.value = cfg.imgId || ''
  refs.aiImgKey.value = cfg.imgKey || ''
  refs.cfgStatus.textContent = ''
}
function goConfigBack() {
  refs.cfgView.classList.add('hidden')
  refs.edit.classList.remove('hidden')
}
function aiConfigFromForm() {
  return {
    baseUrl: refs.aiBase.value.trim(),
    apiKey: refs.aiKey.value.trim(),
    model: refs.aiModel.value.trim(),
    designReq: refs.aiDesign.value.trim(),
    imgId: refs.aiImgId.value.trim(),
    imgKey: refs.aiImgKey.value.trim(),
  }
}
function saveConfigFromForm() {
  const cfg = aiConfigFromForm()
  if (!cfg.baseUrl) { refs.cfgStatus.textContent = '请填写 API 地址'; toast('请填写 API 地址'); return }
  if (!cfg.model) { refs.cfgStatus.textContent = '请填写模型名'; toast('请填写模型名'); return }
  AI.saveConfig(cfg)
  toast('配置已保存')
  goConfigBack()
}
function startElapsed() {
  aiElapsedSec = 0
  refs.aiElapsed.textContent = '0s'
  clearInterval(aiElapsedTimer)
  aiElapsedTimer = setInterval(() => {
    aiElapsedSec++
    refs.aiElapsed.textContent = aiElapsedSec + 's'
    refs.aiStatus.textContent = aiPhase + '… ' + aiElapsedSec + 's'
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
  applyAIPortrait()
}

// ---------- AI 武将图 ----------
function cleanPortraitTerm(text) {
  return String(text || '').replace(/[《》「」【】]/g, '').replace(/[\s,，。.!！?？]+/g, '').trim()
}

function updatePortraitPreview(src, label) {
  refs.imageName.textContent = label
  refs.imagePreview.classList.remove('hidden')
  refs.imagePreview.style.backgroundImage = `url(${src})`
  refs.imagePreview.style.backgroundSize = 'cover'
  refs.imagePreview.style.backgroundPosition = 'center'
}

async function applyAIPortrait() {
  const cfg = AI.loadConfig()
  if (!cfg || !cfg.imgId || !cfg.imgKey) return
  const term = cleanPortraitTerm(refs.aiCharacter.value)
  if (!term) return
  try {
    const res = await searchImages(cfg, term, 1)
    if (!res.urls.length) { toast('未搜到相关图片，可手动选择'); return }
    state.imgSearch = { cfg, term, urls: res.urls, page: res.page, maxpage: res.maxpage, count: res.count, cursor: 0 }
    await loadPortraitAt(0)
  } catch (e) {
    toast('自动获取图片失败：' + ((e && e.message) || '未知错误'))
  }
}

async function loadPortraitAt(index) {
  const s = state.imgSearch
  if (!s || !s.urls || !s.urls[index]) return
  const url = s.urls[index]
  try {
    const { img, src } = await loadImageFromUrl(url)
    const oldSrc = state.card.imageSrc
    state.card.image = img
    state.card.imageSrc = src
    state.card.layout.image = coverTransform(img)
    if (oldSrc && oldSrc.startsWith('blob:')) URL.revokeObjectURL(oldSrc)
    const pos = (s.page - 1) * 10 + index + 1
    updatePortraitPreview(src, `图源 第${pos}张`)
    refs.imgSwap.classList.remove('hidden')
    requestRender()
  } catch (e) {
    toast('图片加载失败，可手动选择')
  }
}

async function swapPortrait() {
  const s = state.imgSearch
  if (!s || !s.urls || !s.urls.length) return
  s.cursor++
  if (s.cursor >= s.urls.length) {
    const nextPage = s.page + 1
    try {
      const next = await searchImages(s.cfg, s.term, nextPage)
      if (!next.urls.length) { toast('没有更多图片了'); s.cursor = s.urls.length - 1; return }
      s.page = next.page
      s.maxpage = next.maxpage
      s.count = next.count
      s.urls = next.urls
      s.cursor = 0
    } catch (e) {
      toast('加载更多图片失败')
      s.cursor = s.urls.length - 1
      return
    }
  }
  await loadPortraitAt(s.cursor)
}

async function generateAI() {
  const character = refs.aiCharacter.value.trim()
  if (!character) { refs.aiStatus.textContent = '请输入人物名'; toast('请输入人物名'); return }
  const cfg = aiConfigFromForm()
  if (!cfg.baseUrl) { refs.aiStatus.textContent = '请填写 API 地址'; toast('请填写 API 地址'); return }
  if (!cfg.model) { refs.aiStatus.textContent = '请填写模型名'; toast('请填写模型名'); return }

  currentAIAbort = new AbortController()
  refs.aiGenerate.disabled = true
  refs.aiStop.disabled = false
  refs.aiProgress.classList.remove('hidden')
  refs.aiCurrent.textContent = ''
  refs.aiStream.textContent = ''
  refs.aiContentBox.classList.add('hidden')
  refs.aiContentBox.open = false
  refs.aiTokens.textContent = ''
  startElapsed()

  try {
    AI.saveConfig(cfg)
    const r = await AI.streamCard({
      character, cfg, signal: currentAIAbort.signal,
      callbacks: {
        onReasoning: (chunk, full) => {
          aiPhase = '思考中'
          renderReasoning(full)
          refs.aiTokens.textContent = '已接收 ' + full.length + ' 字'
        },
        onContent: (chunk, full) => {
          aiPhase = '生成中'
          renderContent(full)
          refs.aiStream.textContent = full
          refs.aiStream.scrollTop = refs.aiStream.scrollHeight
          refs.aiContentBox.classList.remove('hidden')
          refs.aiTokens.textContent = '已接收 ' + full.length + ' 字'
        },
      },
    })
    applyAIResult(r)
    refs.aiStatus.textContent = ''
    toast('已生成武将信息')
    goGenerateBack()
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
    refs.aiStop.disabled = true
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
  refs.aiOpen.addEventListener('click', goGenerate)
  refs.aiConfigOpen.addEventListener('click', goConfig)
  refs.genBack.addEventListener('click', goGenerateBack)
  refs.cfgBack.addEventListener('click', goConfigBack)
  refs.aiSaveConfig.addEventListener('click', saveConfigFromForm)
  attachAIFollow()
  refs.aiGenerate.addEventListener('click', generateAI)
  refs.aiStop.addEventListener('click', stopAI)
  refs.imgSwap.addEventListener('click', swapPortrait)

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
    image: { searchImages, loadImageFromUrl },
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

async function resolveAlbum(Media) {
  const albumName = '三国杀DIY'
  let base = ''
  if (Media && Media.getAlbumsPath) {
    try {
      const ap = await Media.getAlbumsPath()
      if (ap && ap.path) base = String(ap.path).replace(/[\\/]+$/, '')
    } catch (e) { /* 忽略 */ }
  }
  if (base) {
    if (Media && Media.createAlbum) {
      try { await Media.createAlbum({ name: albumName }) } catch (e) { /* 相册已存在则忽略 */ }
    }
    return base + '/' + albumName
  }
  if (Media && Media.getAlbums) {
    const ls = await Media.getAlbums()
    if (ls && ls.albums && ls.albums.length) return ls.albums[0].identifier
  }
  return null
}