import { FACTIONS } from './data.js'

const base = 'assets/slices/'

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}

// 确保书法字体在 canvas 中可用（导出前必须已加载）
async function ensureFont() {
  try {
    await document.fonts.load('72px "SGS Brush"', '武将')
    await document.fonts.load('400 72px "SGS Brush"')
  } catch (e) {
    console.warn('font load failed', e)
  }
  await document.fonts.ready
}

export async function loadAssets() {
  const plates = {}
  const boxes = {}
  const gems = {}
  for (const f of FACTIONS) {
    ;[plates[f], boxes[f], gems[f]] = await Promise.all([
      loadImage(`${base}plate_${f}.png`),
      loadImage(`${base}skillbox_${f}.png`),
      loadImage(`${base}gem_${f}.png`),
    ])
  }
  await ensureFont()
  return { plates, boxes, gems }
}
