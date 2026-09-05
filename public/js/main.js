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
import * as RND from './random.js'

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
  aiModelsBtn: $('#ai-models-btn'),
  modelSheet: $('#model-sheet'),
  modelSheetCard: $('#model-sheet-card'),
  modelSheetHandle: $('#model-sheet-handle'),
  modelSheetClose: $('#model-sheet-close'),
  modelSheetList: $('#model-sheet-list'),
  aiDesign: $('#ai-design'),
  aiSaveConfig: $('#ai-save-config'),
  aiSavePreset: $('#ai-save-preset'),
  aiPresetListBtn: $('#ai-preset-list-btn'),
  presetModal: $('#preset-modal'),
  presetModalTitle: $('#preset-modal-title'),
  presetModalName: $('#preset-modal-name'),
  presetModalList: $('#preset-modal-list'),
  presetModalCancel: $('#preset-modal-cancel'),
  presetModalConfirm: $('#preset-modal-confirm'),
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
  rnd: $('#random-view'),
  rndHome: $('#rnd-home'),
  rndPresetList: $('#rnd-preset-list'),
  rndNew: $('#rnd-new'),
  rndDraw: $('#rnd-draw'),
  rndBack: $('#rnd-back'),
  rndDrawTitle: $('#rnd-draw-title'),
  rndDrawSub: $('#rnd-draw-sub'),
  rndEditBtn: $('#rnd-edit-btn'),
  rndSound: $('#rnd-sound'),
  rndSoundOn: $('#rnd-sound-on'),
  rndSoundOff: $('#rnd-sound-off'),
  rndCountMinus: $('#rnd-count-minus'),
  rndCount: $('#rnd-count'),
  rndCountPlus: $('#rnd-count-plus'),
  rndReplaceField: $('#rnd-replace-field'),
  rndReplaceToggle: $('#rnd-replace-toggle'),
  rndReplaceLabel: $('#rnd-replace-label'),
  rndStatus: $('#rnd-status'),
  rndDrawBtn: $('#rnd-draw-btn'),
  rndResult: $('#rnd-result'),
  rndEdit: $('#rnd-edit'),
  rndEditBack: $('#rnd-edit-back'),
  rndEditTitle: $('#rnd-edit-title'),
  rndEditSub: $('#rnd-edit-sub'),
  rndDelPreset: $('#rnd-del-preset'),
  rndDelModal: $('#rnd-del-modal'),
  rndDelName: $('#rnd-del-name'),
  rndDelNo: $('#rnd-del-no'),
  rndDelYes: $('#rnd-del-yes'),
  rndPreview: $('#rnd-preview'),
  rndSave: $('#rnd-save'),
  rndEditStatus: $('#rnd-edit-status'),
  rndEntries: $('#rnd-entries'),
  rndAddEntry: $('#rnd-add-entry'),
  drawer: $('#drawer'),
  drawerCard: $('#drawer-card'),
  rndNameModal: $('#rnd-name-modal'),
  rndNameTitle: $('#rnd-name-title'),
  rndNameInput: $('#rnd-name-input'),
  rndNameCancel: $('#rnd-name-cancel'),
  rndNameConfirm: $('#rnd-name-confirm'),

}

let toastTimer = 0
let presetModalMode = 'save'

const rndState = {
  currentName: '',
  originalName: '',
  entries: [],
  editFrom: 'home',
}
let rndNameMode = 'new'
let rndSoundOn = true
let rndAudioCtx = null

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

let drawerDrag = false
let drawerStartX = 0
let drawerDx = 0
let drawerCloseTimer = 0
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
  const base = baseNameFor(state.card)
  if (isNative()) {
    const Media = capPlugin('Media')
    if (!Media || !Media.savePhoto) { toast('相册插件未加载'); return }
    toast('正在保存图片…')
    try {
      const albumDir = await resolveAlbum(Media)
      const fileName = await nextAlbumName(albumDir, base)
      toast('保存至：' + (albumDir || '相册') + '/' + fileName)
      const blob = await renderCardImage(state.card, state.assets, 'image/jpeg', 0.92)
      const dataUrl = await blobToDataUrl(blob)
      await Media.savePhoto({ path: dataUrl, fileName, albumIdentifier: albumDir })
    } catch (e) {
      toast('保存失败：' + ((e && e.message) || '未知错误'))
    }
    return
  }
  const filename = filenameFor(state.card, 'jpg')
  toast('保存至：' + filename)
  try {
    const blob = await renderCardImage(state.card, state.assets, 'image/jpeg', 0.92)
    const shared = await shareBlob(blob, filename, 'image/jpeg')
    if (!shared) downloadBlob(blob, filename)
  } catch (e) {
    toast('保存失败：' + ((e && e.message) || '未知错误'))
  }
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
  const img = AI.loadImgConfig()
  refs.aiImgId.value = img.imgId || ''
  refs.aiImgKey.value = img.imgKey || ''
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
  const img = AI.loadImgConfig()
  refs.aiImgId.value = img.imgId || ''
  refs.aiImgKey.value = img.imgKey || ''
  refs.cfgStatus.textContent = ''
  closePresetModal()
}
function goConfigBack() {
  refs.cfgView.classList.add('hidden')
  refs.edit.classList.remove('hidden')
  closeModelSheet()
}
function aiConfigFromForm() {
  return {
    baseUrl: refs.aiBase.value.trim(),
    apiKey: refs.aiKey.value.trim(),
    model: refs.aiModel.value.trim(),
    designReq: refs.aiDesign.value.trim(),
  }
}
function imgConfigFromForm() {
  return {
    imgId: refs.aiImgId.value.trim(),
    imgKey: refs.aiImgKey.value.trim(),
  }
}
function saveConfigFromForm() {
  const cfg = aiConfigFromForm()
  if (!cfg.baseUrl) { refs.cfgStatus.textContent = '请填写 API 地址'; toast('请填写 API 地址'); return }
  if (!cfg.model) { refs.cfgStatus.textContent = '请填写模型名'; toast('请填写模型名'); return }
  AI.saveConfig(cfg)
  AI.saveImgConfig(imgConfigFromForm())
  toast('配置已保存')
  goConfigBack()
}

function saveAsPresetFromTop() {
  const cfg = aiConfigFromForm()
  if (!cfg.baseUrl) { refs.cfgStatus.textContent = '请填写 API 地址'; toast('请填写 API 地址'); return }
  if (!cfg.model) { refs.cfgStatus.textContent = '请填写模型名'; toast('请填写模型名'); return }
  presetModalMode = 'save'
  refs.presetModalTitle.textContent = '存至预设'
  refs.presetModalName.value = ''
  refs.presetModalName.classList.remove('hidden')
  refs.presetModalList.classList.add('hidden')
  refs.presetModalConfirm.classList.remove('hidden')
  openPresetModal()
}

function openPresetList() {
  presetModalMode = 'list'
  refs.presetModalTitle.textContent = '配置列表'
  refs.presetModalName.classList.add('hidden')
  refs.presetModalList.classList.remove('hidden')
  refs.presetModalConfirm.classList.add('hidden')
  renderPresetRows()
  openPresetModal()
}

function renderPresetRows() {
  const presets = AI.loadPresets()
  const names = Object.keys(presets)
  const list = refs.presetModalList
  list.innerHTML = ''
  if (!names.length) {
    const empty = document.createElement('div')
    empty.className = 'preset-empty'
    empty.textContent = '暂无已存预设'
    list.appendChild(empty)
    return
  }
  for (const name of names) {
    const row = document.createElement('div')
    row.className = 'preset-row-item'
    row.dataset.name = name

    const nm = document.createElement('span')
    nm.className = 'preset-row-name'
    nm.textContent = name
    nm.title = name
    row.appendChild(nm)

    const del = document.createElement('button')
    del.className = 'preset-row-del'
    del.type = 'button'
    del.textContent = '删除'
    row.appendChild(del)

    list.appendChild(row)
  }
}

function enterPresetRowConfirm(row) {
  const name = row.dataset.name
  row.className = 'preset-row-item preset-row-confirm'
  row.innerHTML = ''
  const txt = document.createElement('span')
  txt.className = 'preset-confirm-text'
  txt.textContent = '确认删除？'
  const yes = document.createElement('button')
  yes.className = 'preset-confirm-yes'
  yes.type = 'button'
  yes.textContent = '确认'
  const no = document.createElement('button')
  no.className = 'preset-confirm-no'
  no.type = 'button'
  no.textContent = '取消'
  row.appendChild(txt)
  row.appendChild(yes)
  row.appendChild(no)
}

function loadPresetByName(name) {
  const presets = AI.loadPresets()
  const cfg = presets[name]
  if (!cfg) { toast('预设不存在或已删除'); return }
  refs.aiBase.value = cfg.baseUrl || ''
  refs.aiKey.value = cfg.apiKey || ''
  refs.aiModel.value = cfg.model || ''
  refs.aiDesign.value = cfg.designReq || ''
  AI.saveActiveName(name)
  closePresetModal()
  refs.cfgStatus.textContent = '已载入预设：' + name
  toast('已读取预设')
}

function onPresetListClick(e) {
  const row = e.target.closest('.preset-row-item')
  if (!row) return
  const name = row.dataset.name
  const t = e.target
  if (t.classList.contains('preset-row-del')) {
    enterPresetRowConfirm(row)
  } else if (t.classList.contains('preset-confirm-yes')) {
    AI.removePreset(name)
    renderPresetRows()
  } else if (t.classList.contains('preset-confirm-no')) {
    renderPresetRows()
  } else if (t.classList.contains('preset-row-name')) {
    loadPresetByName(name)
  }
}

function confirmPresetModal() {
  if (presetModalMode !== 'save') return
  const name = refs.presetModalName.value.trim()
  if (!name) { toast('请输入预设名'); return }
  const cfg = aiConfigFromForm()
  AI.saveAsPreset(name, cfg)
  AI.saveImgConfig(imgConfigFromForm())
  closePresetModal()
  toast('已存至预设')
}

function openPresetModal() { refs.presetModal.classList.remove('hidden') }
function closePresetModal() { refs.presetModal.classList.add('hidden') }
  let modelSheetDrag = false
  let modelSheetStartY = 0
  let modelSheetDy = 0

  function renderModelSheet(ids) {
    const list = refs.modelSheetList
    list.innerHTML = ''
    if (!ids.length) {
      const empty = document.createElement('div')
      empty.className = 'sheet-empty'
      empty.textContent = '未获取到模型'
      list.appendChild(empty)
      return
    }
    for (const id of ids) {
      const row = document.createElement('div')
      row.className = 'sheet-row'
      row.dataset.model = id
      row.textContent = id
      list.appendChild(row)
    }
  }

  function openModelSheet() {
    const mask = refs.modelSheet
    mask.classList.remove('hidden')
    void mask.offsetWidth
    mask.classList.add('show')
  }

  function closeModelSheet() {
    const mask = refs.modelSheet
    const card = refs.modelSheetCard
    card.style.transition = ''
    card.style.transform = ''
    mask.classList.remove('show')
    clearTimeout(drawerCloseTimer)

  drawerCloseTimer = setTimeout(() => { mask.classList.add('hidden'); card.style.transition = ''; card.style.transform = '' }, 300)
  }

  function onModelSheetSelect(e) {
    const row = e.target.closest('.sheet-row')
    if (!row) return
    refs.aiModel.value = row.dataset.model || ''
    closeModelSheet()
  }

  function setupModelSheetDrag() {
    const card = refs.modelSheetCard
    const handle = refs.modelSheetHandle
    const mask = refs.modelSheet
    handle.addEventListener('pointerdown', (e) => {
      modelSheetDrag = true
      modelSheetStartY = e.clientY
      modelSheetDy = 0
      card.style.transition = 'none'
      if (handle.setPointerCapture) { try { handle.setPointerCapture(e.pointerId) } catch (err) {} }
    })
    handle.addEventListener('pointermove', (e) => {
      if (!modelSheetDrag) return
      modelSheetDy = Math.max(0, e.clientY - modelSheetStartY)
      card.style.transform = 'translateY(' + modelSheetDy + 'px)'
    })
    const release = () => {
      if (!modelSheetDrag) return
      modelSheetDrag = false
      if (modelSheetDy > 120) {
        card.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)'
        card.style.transform = 'translateY(100%)'
        mask.classList.remove('show')
        clearTimeout(drawerCloseTimer)

  drawerCloseTimer = setTimeout(() => { mask.classList.add('hidden'); card.style.transition = ''; card.style.transform = '' }, 300)
      } else {
        card.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)'
        card.style.transform = ''
      }
      modelSheetDy = 0
    }
    handle.addEventListener('pointerup', release)
    handle.addEventListener('pointercancel', release)
  }

async function fetchModelList() {
  const baseUrl = refs.aiBase.value.trim()
  const apiKey = refs.aiKey.value.trim()
  if (!baseUrl) { refs.cfgStatus.textContent = '请先填写 API 地址'; toast('请先填写 API 地址'); return }
  refs.aiModelsBtn.disabled = true
  refs.aiModelsBtn.textContent = '获取中…'
  refs.cfgStatus.textContent = '正在获取模型列表…'
  try {
    const ids = await AI.fetchModels({ baseUrl, apiKey })
    if (!ids.length) { refs.cfgStatus.textContent = '接口未返回可用模型'; toast('未获取到模型'); return }
    renderModelSheet(ids)
    refs.cfgStatus.textContent = '获取到 ' + ids.length + ' 个模型'
    openModelSheet()
  } catch (e) {
    refs.cfgStatus.textContent = (e && e.message) || '获取模型列表失败'
    toast('获取模型列表失败，请手动填写模型名')
  } finally {
    refs.aiModelsBtn.disabled = false
    refs.aiModelsBtn.textContent = '获取模型列表'
  }
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
  const cfg = AI.loadImgConfig()
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
  if (refs.aiGenerate.disabled) return
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

// ---------- 左抽屉导航 ----------
function hideAllViews() {
  ;[refs.edit, refs.layout, refs.genView, refs.cfgView, refs.rnd].forEach((v) => v.classList.add('hidden'))
}
function openDrawer() {
  const mask = refs.drawer
  clearTimeout(drawerCloseTimer)
  mask.classList.remove('hidden')
  void mask.offsetWidth
  mask.classList.add('show')
}
function closeDrawer() {
  const mask = refs.drawer
  const card = refs.drawerCard
  card.style.transition = ''
  card.style.transform = ''
  mask.classList.remove('show')
  clearTimeout(drawerCloseTimer)

  drawerCloseTimer = setTimeout(() => { mask.classList.add('hidden'); card.style.transition = ''; card.style.transform = '' }, 300)
}
function onDrawerItemClick(e) {
  // drawer-card 在 pointerdown 时 setPointerCapture，会把 click 的 target
  // 重定向给卡片本身，导致 e.target.closest 命中不到菜单项。
  // 这里用坐标回退，命中不了再取真实点击位置下的元素。
  const findItem = (el) => (el && el.closest ? el.closest('.drawer-item') : null)
  const item = findItem(e.target) || findItem(document.elementFromPoint(e.clientX, e.clientY))
  if (!item) return
  const mod = item.dataset.module
  closeDrawer()
  if (mod === 'random') goRandom()
  else goEditMain()
}
function setupDrawerDrag() {
  const card = refs.drawerCard
  const mask = refs.drawer
  card.addEventListener('pointerdown', (e) => {
    drawerDrag = true
    drawerStartX = e.clientX
    drawerDx = 0
    card.style.transition = 'none'
    if (card.setPointerCapture) { try { card.setPointerCapture(e.pointerId) } catch (err) {} }
  })
  card.addEventListener('touchmove', (e) => {
    if (drawerDrag) e.preventDefault()
  }, { passive: false })
  card.addEventListener('pointermove', (e) => {
    if (!drawerDrag) return
    drawerDx = Math.min(0, e.clientX - drawerStartX)
    card.style.transform = 'translateX(' + drawerDx + 'px)'
  })
  const release = () => {
    if (!drawerDrag) return
    drawerDrag = false
    if (drawerDx < -80) {
      card.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)'
      card.style.transform = 'translateX(-100%)'
      mask.classList.remove('show')
      clearTimeout(drawerCloseTimer)
      drawerCloseTimer = setTimeout(() => { mask.classList.add('hidden'); card.style.transition = ''; card.style.transform = '' }, 300)
    } else {
      card.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)'
      card.style.transform = ''
    }
    drawerDx = 0
  }
  card.addEventListener('pointerup', release)
  card.addEventListener('pointercancel', release)
}

// ---------- 随机抽取 ----------
function goRandom() {
  hideAllViews()
  refs.rnd.classList.remove('hidden')
  showRandomHome()
}
function goEditMain() {
  hideAllViews()
  refs.edit.classList.remove('hidden')
}
function showRandomHome() {
  RND.ensureDefaultPreset()
  refs.rndHome.classList.remove('hidden')
  refs.rndDraw.classList.add('hidden')
  refs.rndEdit.classList.add('hidden')
  rndState.currentName = ''
  rndState.originalName = ''
  rndState.entries = []
  renderRndPresetList()
}
function validRndEntries(list) {
  return (list || rndState.entries).filter((e) => String(e.name || '').trim().length > 0)
}
function rndCount() {
  return validRndEntries().length
}
function renderRndPresetList() {
  const presets = RND.loadPresets()
  const names = Object.keys(presets).sort(RND.compareText)
  const list = refs.rndPresetList
  list.innerHTML = ''
  if (!names.length) {
    const empty = document.createElement('div')
    empty.className = 'rnd-empty'
    empty.textContent = '还没有预设，点击右上角新建'
    list.appendChild(empty)
    return
  }
  names.forEach((name) => {
    const row = document.createElement('div')
    row.className = 'rnd-preset-item'
    row.dataset.name = name
    row.innerHTML =
      '<span class="rnd-preset-name" title="' + esc(name) + '">' + esc(name) + '</span>' +
      '<div class="rnd-preset-actions">' +
        '<button class="rnd-act rnd-act-edit" type="button">编辑</button>' +
        '<span class="rnd-preset-chev">&#8250;</span>' +
      '</div>'
    list.appendChild(row)
  })
}
function onRndPresetListClick(e) {
  const row = e.target.closest('.rnd-preset-item')
  if (!row) return
  const name = row.dataset.name
  if (e.target.classList.contains('rnd-act-edit')) { loadRndPreset(name, 'edit'); return }
  loadRndPreset(name, 'draw')
}
function loadRndPreset(name, goTo) {
  const p = RND.getPreset(name)
  if (!p) { toast('预设不存在或已删除'); return }
  rndState.currentName = name
  rndState.originalName = name
  rndState.entries = (p.entries || []).map((e) => ({ id: e.id, name: e.name, weight: RND.clampWeight(e.weight) }))
  refs.rndDrawTitle.textContent = name
  refs.rndDrawSub.textContent = rndCount() + ' 条'
  renderRndPreview()
  resetDrawPanel()
  if (goTo === 'edit') { goRndEdit('home'); return }
  if (!rndCount()) { toast('该预设暂无条目'); goRndEdit('home'); return }
  refs.rndHome.classList.add('hidden')
  refs.rndEdit.classList.add('hidden')
  refs.rndDraw.classList.remove('hidden')
}
function onRndDrawBack() { showRandomHome() }
function goRndEdit(from) {
  rndState.editFrom = from || 'home'
  refs.rndHome.classList.add('hidden')
  refs.rndDraw.classList.add('hidden')
  refs.rndEdit.classList.remove('hidden')
  refs.rndEditTitle.textContent = rndState.currentName || '编辑预设'
  refs.rndEditSub.textContent = rndCount() + ' 条'
  refs.rndEditStatus.textContent = ''
  refs.rndDelModal.classList.add('hidden')
  renderRndEntries()
}
function onRndEditBack() {
  if (rndState.editFrom === 'draw') {
    refs.rndEdit.classList.add('hidden')
    refs.rndDraw.classList.remove('hidden')
    refs.rndDrawSub.textContent = rndCount() + ' 条'
    renderRndPreview()
  } else showRandomHome()
}
function resetDrawPanel() {
  refs.rndCount.value = 1
  refs.rndReplaceToggle.classList.remove('on')
  refs.rndReplaceToggle.setAttribute('aria-checked', 'false')
  refs.rndReplaceLabel.textContent = '放回抽取'
  refs.rndReplaceField.hidden = true
  refs.rndStatus.textContent = ''
  refs.rndResult.classList.add('hidden')
}
function openRndNameModal() {
  rndNameMode = 'new'
  refs.rndNameTitle.textContent = '新建预设'
  refs.rndNameInput.value = ''
  refs.rndNameModal.classList.remove('hidden')
  refs.rndNameInput.focus()
}

function openRndRenameModal() {
  if (!rndState.currentName) return
  rndNameMode = 'rename'
  refs.rndNameTitle.textContent = '重命名预设'
  refs.rndNameInput.value = rndState.currentName
  refs.rndNameModal.classList.remove('hidden')
  refs.rndNameInput.focus()
  refs.rndNameInput.setSelectionRange(refs.rndNameInput.value.length, refs.rndNameInput.value.length)
}
function closeRndNameModal() { refs.rndNameModal.classList.add('hidden') }
function confirmRndNameModal() {
  const name = refs.rndNameInput.value.trim()
  if (!name) { toast('请输入预设名'); return }
  if (rndNameMode === 'rename') {
    if (name === rndState.currentName) { closeRndNameModal(); return }
    if (RND.getPreset(name)) { toast('已存在同名预设'); return }
    const old = rndState.originalName
    RND.savePreset(name, validRndEntries())
    if (old && old !== name) RND.removePreset(old)
    rndState.currentName = name
    rndState.originalName = name
    refs.rndEditTitle.textContent = name
    closeRndNameModal()
    toast('已重命名')
    return
  }
  if (RND.getPreset(name)) { toast('已存在同名预设，请直接打开编辑'); return }
  rndState.currentName = name
  rndState.originalName = name
  rndState.entries = []
  closeRndNameModal()
  goRndEdit('home')
}
function saveRndPreset() {
  const name = String(rndState.currentName || '').trim()
  if (!name) { refs.rndEditStatus.textContent = '请输入预设名'; toast('请输入预设名'); return }
  const entries = validRndEntries()
  if (!entries.length) { refs.rndEditStatus.textContent = '请至少添加一个条目'; toast('请至少添加一个条目'); return }
  const oldName = rndState.originalName
  RND.savePreset(name, entries)
  if (oldName && oldName !== name) RND.removePreset(oldName)
  rndState.originalName = name
  rndState.currentName = name
  rndState.entries = entries
  refs.rndDrawTitle.textContent = name
  refs.rndDrawSub.textContent = entries.length + ' 条'
  refs.rndEditStatus.textContent = ''
  renderRndPreview()
  resetDrawPanel()
  refs.rndEdit.classList.add('hidden')
  refs.rndHome.classList.add('hidden')
  refs.rndDraw.classList.remove('hidden')
  toast('已保存预设')
}
function closeRndDelModal() { refs.rndDelModal.classList.add('hidden') }
function onRndDelPreset() {
  refs.rndDelName.textContent = rndState.currentName || '该预设'
  refs.rndDelModal.classList.remove('hidden')
}
function confirmRndDelPreset() {
  const name = rndState.currentName
  closeRndDelModal()
  if (!name) return
  RND.removePreset(name)
  toast('已删除预设')
  showRandomHome()
}
function renderRndEntries() {
  const sorted = RND.sortEntries(validRndEntries()).concat(rndState.entries.filter((e) => !String(e.name || '').trim()))
  const wrap = refs.rndEntries
  if (!sorted.length) {
    wrap.innerHTML = '<div class="rnd-empty">暂无条目，点击下方新增</div>'
    return
  }
  wrap.innerHTML = sorted.map((e) => {
    const blank = !String(e.name || '').trim()
    return '<div class="rnd-entry-card' + (blank ? ' rnd-entry-blank' : '') + '" data-id="' + e.id + '">' +
      '<input class="rnd-entry-name" type="text" maxlength="24" placeholder="名称" value="' + esc(e.name) + '">' +
      '<div class="rnd-weight-row">' +
        '<button class="stepbtn xs rnd-w-minus" type="button" aria-label="减少权重">&#8722;</button>' +
        '<input class="rnd-weight" type="number" min="1" max="99" value="' + RND.clampWeight(e.weight) + '">' +
        '<button class="stepbtn xs rnd-w-plus" type="button" aria-label="增加权重">&#65291;</button>' +
      '</div>' +
    '</div>'
  }).join('')
}
function updateRndEditSub() { refs.rndEditSub.textContent = rndCount() + ' 条' }
function addRndEntry() {
  if (rndState.entries.length >= RND.RND_MAX_ENTRIES) { toast('最多 99 条'); return }
  const entry = RND.makeEntry('', 1)
  rndState.entries.push(entry)
  renderRndEntries()
  updateRndEditSub()
  requestAnimationFrame(() => {
    const card = refs.rndEntries.querySelector('.rnd-entry-card[data-id="' + entry.id + '"]')
    const inp = card && card.querySelector('.rnd-entry-name')
    if (inp) { inp.focus(); inp.select() }
  })
}
function removeRndEntry(id) {
  rndState.entries = rndState.entries.filter((x) => x.id !== id)
  renderRndEntries()
  updateRndEditSub()
}
function onRndEntriesClick(e) {
  const card = e.target.closest('.rnd-entry-card')
  if (!card) return
  const id = card.dataset.id
  const entry = rndState.entries.find((x) => x.id === id)
  if (!entry) return
  const wInput = card.querySelector('.rnd-weight')
  if (e.target.classList.contains('rnd-w-minus')) {
    if (entry.weight <= 1) removeRndEntry(id)
    else { entry.weight--; if (wInput) wInput.value = entry.weight }
  } else if (e.target.classList.contains('rnd-w-plus')) {
    if (entry.weight >= RND.RND_MAX_WEIGHT) { toast('权重最大 99'); return }
    entry.weight++
    if (wInput) wInput.value = entry.weight
  }
}
function onRndEntriesInput(e) {
  const card = e.target.closest('.rnd-entry-card')
  if (!card) return
  const entry = rndState.entries.find((x) => x.id === card.dataset.id)
  if (!entry) return
  if (e.target.classList.contains('rnd-entry-name')) {
    entry.name = e.target.value
    card.classList.toggle('rnd-entry-blank', !String(entry.name).trim())
    updateRndEditSub()
  } else if (e.target.classList.contains('rnd-weight')) {
    const raw = e.target.value
    if (parseInt(raw, 10) === 0) { removeRndEntry(card.dataset.id); return }
    const w = RND.clampWeight(raw)
    entry.weight = w
    if (String(w) !== raw) e.target.value = w
  }
}
function onRndEntriesFocusOut(e) {
  if (e.target.classList.contains('rnd-entry-name')) {
    const rt = e.relatedTarget
    if (rt && rt.closest && rt.closest('.rnd-entry-card')) return
    const card = e.target.closest('.rnd-entry-card')
    const entry = card && rndState.entries.find((x) => x.id === card.dataset.id)
    if (entry) entry.name = String(entry.name).trim()
    rndState.entries = RND.sortEntries(validRndEntries()).concat(rndState.entries.filter((x) => !String(x.name || '').trim()))
    renderRndEntries()
    updateRndEditSub()
  } else if (e.target.classList.contains('rnd-weight')) {
    const card = e.target.closest('.rnd-entry-card')
    if (!card) return
    const entry = rndState.entries.find((x) => x.id === card.dataset.id)
    if (!entry) return
    e.target.value = entry.weight
  }
}
function noReplace() { return refs.rndReplaceToggle.classList.contains('on') }
function countMax() { return Math.max(1, rndCount()) }
function onRndCountMinus() {
  let v = parseInt(refs.rndCount.value, 10) || 1
  v--
  if (v < 1) v = 1
  refs.rndCount.value = v
  updateRndReplaceField()
}
function onRndCountPlus() {
  let v = parseInt(refs.rndCount.value, 10) || 1
  if (v >= RND.RND_MAX_COUNT) return
  v++
  if (noReplace() && v > countMax()) { toast('最多 ' + countMax() + ' 个'); return }
  refs.rndCount.value = v
  updateRndReplaceField()
}
function onRndCountInput() {
  let v = parseInt(refs.rndCount.value, 10) || 1
  if (v < 1) v = 1
  if (noReplace()) {
    if (v > countMax()) v = countMax()
  } else if (v > RND.RND_MAX_COUNT) {
    v = RND.RND_MAX_COUNT
  }
  refs.rndCount.value = v
  updateRndReplaceField()
}
function updateRndReplaceField() {
  const v = parseInt(refs.rndCount.value, 10) || 1
  refs.rndReplaceField.hidden = v <= 1
}
function onRndReplaceToggle() {
  const on = refs.rndReplaceToggle.classList.toggle('on')
  refs.rndReplaceToggle.setAttribute('aria-checked', on ? 'true' : 'false')
  refs.rndReplaceLabel.textContent = on ? '不放回抽取' : '放回抽取'
  if (on) {
    const max = countMax()
    let v = parseInt(refs.rndCount.value, 10) || 1
    if (v > max) refs.rndCount.value = max
  }
  updateRndReplaceField()
}
function ensureRndAudio() {
  if (rndAudioCtx) return rndAudioCtx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try { rndAudioCtx = new AC() } catch (e) { rndAudioCtx = null }
  return rndAudioCtx
}
function playRndSound() {
  if (!rndSoundOn) return
  const ctx = ensureRndAudio()
  if (!ctx) return
  // WebView 下首次 AudioContext 常处于 suspended，resume 是异步的，
  // 需等它就绪后再建节点，否则 osc.start 可能被丢弃。
  const ready = ctx.state === 'suspended'
    ? (typeof ctx.resume === 'function' ? ctx.resume() : Promise.resolve())
    : Promise.resolve()
  const play = () => {
    const t0 = ctx.currentTime
    const master = ctx.createGain()
    // 总输出增益：0.0001 -> 1 -> 0.0001，既能听清又不爆音
    master.gain.setValueAtTime(0.0001, t0)
    master.gain.exponentialRampToValueAtTime(1, t0 + 0.014)
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36)
    master.connect(ctx.destination)
    const mk = (freq, start, dur, peak) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0.0001, t0 + start)
      g.gain.exponentialRampToValueAtTime(peak, t0 + start + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
      osc.connect(g)
      g.connect(master)
      osc.start(t0 + start)
      osc.stop(t0 + start + dur + 0.02)
    }
    // 固定的“叮”揭晓音：先一个落点，再上扬泛音，参数写死，每次一致
    mk(880, 0, 0.34, 0.16)
    mk(1318, 0.05, 0.30, 0.10)
  }
  try {
    if (ready && typeof ready.then === 'function') ready.then(play).catch(() => {})
    else play()
  } catch (e) {}
}
function onRndSoundToggle() {
  rndSoundOn = !rndSoundOn
  refs.rndSoundOn.classList.toggle('hidden', !rndSoundOn)
  refs.rndSoundOff.classList.toggle('hidden', rndSoundOn)
  refs.rndSound.setAttribute('aria-pressed', rndSoundOn ? 'true' : 'false')
}
function onRndDrawClick() {
  const valid = validRndEntries()
  if (!valid.length) { refs.rndStatus.textContent = '当前预设没有条目'; toast('当前预设没有条目'); return }
  const count = parseInt(refs.rndCount.value, 10) || 1
  const withoutReplacement = refs.rndReplaceToggle.classList.contains('on')
  const results = RND.drawEntries(valid, count, withoutReplacement)
  renderRndResult(results, count)
  playRndSound()
  if (withoutReplacement && results.length < count) refs.rndStatus.textContent = '本次仅抽到 ' + results.length + ' 项'
  else refs.rndStatus.textContent = ''
}
function renderRndPreview() {
  const box = refs.rndPreview
  const valid = validRndEntries()
  if (!valid.length) { box.innerHTML = '<span class="rnd-preview-empty">暂无条目</span>'; return }
  box.innerHTML = valid.map((e) => '<span class="rnd-preview-chip">' + esc(e.name) + '</span>').join('')
}
function renderRndResult(results, requested) {
  const box = refs.rndResult
  box.classList.remove('hidden')
  box.innerHTML = '<div class="rnd-result-grid">' + results.map((r) => '<span class="rnd-result-chip">' + esc(r ? r.name : '无') + '</span>').join('') + '</div>'
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
  refs.aiSavePreset.addEventListener('click', saveAsPresetFromTop)
  refs.aiPresetListBtn.addEventListener('click', openPresetList)
  refs.aiModelsBtn.addEventListener('click', fetchModelList)
  refs.modelSheetClose.addEventListener('click', closeModelSheet)
  refs.modelSheet.addEventListener('click', (e) => { if (e.target === refs.modelSheet) closeModelSheet() })
  refs.modelSheetList.addEventListener('click', onModelSheetSelect)
  setupModelSheetDrag()
  refs.presetModalCancel.addEventListener('click', closePresetModal)
  refs.presetModalConfirm.addEventListener('click', confirmPresetModal)
  refs.presetModal.addEventListener('click', (e) => { if (e.target === refs.presetModal) closePresetModal() })
  refs.presetModalName.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmPresetModal() })
  refs.presetModalList.addEventListener('click', onPresetListClick)
  attachAIFollow()
  refs.aiGenerate.addEventListener('click', generateAI)
  document.querySelectorAll('.menu-open').forEach((b) => b.addEventListener('click', openDrawer))
  refs.drawer.addEventListener('click', (e) => { if (e.target === refs.drawer) closeDrawer() })
  refs.drawerCard.addEventListener('click', onDrawerItemClick)
  setupDrawerDrag()
  refs.rndNew.addEventListener('click', openRndNameModal)
  refs.rndBack.addEventListener('click', onRndDrawBack)
  refs.rndEditBtn.addEventListener('click', () => goRndEdit('draw'))
  refs.rndCountMinus.addEventListener('click', onRndCountMinus)
  refs.rndCountPlus.addEventListener('click', onRndCountPlus)
  refs.rndCount.addEventListener('input', onRndCountInput)
  refs.rndReplaceToggle.addEventListener('click', onRndReplaceToggle)
  refs.rndSound.addEventListener('click', onRndSoundToggle)
  refs.rndSound.setAttribute('aria-pressed', rndSoundOn ? 'true' : 'false')
  refs.rndDrawBtn.addEventListener('click', onRndDrawClick)
  refs.rndEditBack.addEventListener('click', onRndEditBack)
  refs.rndEditTitle.addEventListener('click', openRndRenameModal)
  refs.rndSave.addEventListener('click', saveRndPreset)
  refs.rndDelPreset.addEventListener('click', onRndDelPreset)
  refs.rndDelNo.addEventListener('click', closeRndDelModal)
  refs.rndDelYes.addEventListener('click', confirmRndDelPreset)
  refs.rndDelModal.addEventListener('click', (e) => { if (e.target === refs.rndDelModal) closeRndDelModal() })
  refs.rndAddEntry.addEventListener('click', addRndEntry)
  refs.rndEntries.addEventListener('click', onRndEntriesClick)
  refs.rndEntries.addEventListener('input', onRndEntriesInput)
  refs.rndEntries.addEventListener('focusout', onRndEntriesFocusOut)
  refs.rndPresetList.addEventListener('click', onRndPresetListClick)
  refs.rndNameCancel.addEventListener('click', closeRndNameModal)
  refs.rndNameConfirm.addEventListener('click', confirmRndNameModal)
  refs.rndNameModal.addEventListener('click', (e) => { if (e.target === refs.rndNameModal) closeRndNameModal() })
  refs.rndNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmRndNameModal() })
  refs.aiStop.addEventListener('click', stopAI)
  refs.imgSwap.addEventListener('click', swapPortrait)

  // 手机返回键：与各页面左上角返回键等效
  const App = capPlugin('App')
  if (App && typeof App.addListener === 'function') {
    App.addListener('backButton', ({ canGoBack } = {}) => {
      if (!refs.genView.classList.contains('hidden')) { goGenerateBack(); return }
      if (!refs.cfgView.classList.contains('hidden')) { goConfigBack(); return }
      if (!refs.layout.classList.contains('hidden')) { goEdit(); return }
      if (canGoBack && window.history && window.history.length > 1) { window.history.back(); return }
      if (App.exitApp) App.exitApp()
    })
  }

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