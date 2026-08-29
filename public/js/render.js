import { CARD_W, CARD_H, FACTIONS, FACTION_LABEL } from './data.js'

export const BRUSH_FONT = "'SGS Brush','Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi',cursive"
export const DESC_FONT = "'PingFang SC','Microsoft YaHei','Hiragino Sans GB',system-ui,sans-serif"

// 布局常量（卡面逻辑坐标 1425x2048）
export const LAYOUT = {
  nameFont: 96,
  nameStep: 112,
  titleFont: 78,
  titleStep: 94,
  nameColor: '#f7f1e4',
  titleColor: '#f3dfa0',
  textOutline: '#1c1206',
  outlineWidth: 7,

  panelWidth: 240, // 左侧立板不透明宽度

  gemSize: 1.05,   // 勾玉相对素材缩放
  gemGap: 12,
  gemStartX: 300,
  gemStartY: 140,
  gemRightMargin: 66, // 勾玉铺到右侧留白处才换行

  skillLeft: 64,
  boxW: 216,
  boxH: 104,
  boxScale: 1,
  descLeft: 312,
  descRightMargin: 34,
  descFont: 46,
  descLineH: 58,
  skillNameFont: 46,
  skillGap: 52,
  bandPadTop: 26,
  bandPadBottom: 44,
}

function withFont(ctx, family, size) {
  ctx.font = `${size}px ${family}`
}

function fillText(ctx, text, x, y, fill, stroke, strokeW) {
  if (stroke) {
    ctx.lineWidth = strokeW
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.strokeStyle = stroke
    ctx.strokeText(text, x, y)
  }
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

function drawVerticalText(ctx, text, cx, top, font, color, stroke, strokeW) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  withFont(ctx, BRUSH_FONT, font)
  const step = font * 1.16
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 4
  for (let i = 0; i < text.length; i++) {
    const y = top + step * i + step / 2
    fillText(ctx, text[i], cx, y, color, stroke, strokeW)
  }
  ctx.restore()
}

function drawImage(ctx, card, assets) {
  const img = card.image
  if (!img) return
  const t = card.layout.image
  const w = (img.naturalWidth || img.width) * t.scale
  const h = (img.naturalHeight || img.height) * t.scale
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, CARD_W, CARD_H)
  ctx.clip()
  ctx.drawImage(img, t.x - w / 2, t.y - h / 2, w, h)
  ctx.restore()
}

function drawPlate(ctx, card, assets) {
  ctx.drawImage(assets.plates[card.faction], 0, 0, CARD_W, CARD_H)
}

function drawGems(ctx, card, assets) {
  const gem = assets.gems[card.faction]
  if (!gem || card.hp <= 0) return
  const L = LAYOUT
  const gw = gem.width * L.gemSize
  const gh = gem.height * L.gemSize
  let { gemStartX: sx, gemStartY: sy, gemGap } = L
  // 按右侧可用宽度动态决定每行能放多少勾玉：铺到最右边缘才换行
  const availW = CARD_W - sx - L.gemRightMargin
  const perRow = Math.max(1, Math.floor((availW + gemGap) / (gw + gemGap)))
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < card.hp; i++) {
    const col = i % perRow
    const row = Math.floor(i / perRow)
    const x = sx + col * (gw + gemGap)
    const y = sy + row * (gh + 6)
    ctx.drawImage(gem, x, y, gw, gh)
  }
  ctx.restore()
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return []
  const lines = []
  let line = ''
  for (const ch of text) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

export function computeSkills(ctx, card) {
  const L = LAYOUT
  const descW = CARD_W - L.descLeft - L.descRightMargin
  ctx.save()
  withFont(ctx, DESC_FONT, L.descFont)
  const rows = []
  for (let i = 0; i < card.skills.length; i++) {
    const skill = card.skills[i]
    const lines = wrapText(ctx, skill.desc, descW)
    const blockH = Math.max(1, lines.length) * L.descLineH
    rows.push({
      i,
      name: skill.name,
      desc: skill.desc,
      lines,
      blockH,
    })
  }
  ctx.restore()
  if (!rows.length) return { rows: [], bandTop: 0, bandBottom: 0 }

  // 白色透明底严格贴住卡底；内容也从底部往上排，使整个技能区紧挨卡底
  const bandBottom = CARD_H
  const layoutRows = []
  let bottom = bandBottom - L.bandPadBottom
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]
    const descTop = bottom - r.blockH
    const boxY = descTop + L.descLineH / 2 - L.boxH / 2 // 技能框垂直对齐技能描述首行
    layoutRows.unshift({
      ...r,
      boxX: L.skillLeft,
      boxY,
      boxW: L.boxW,
      boxH: L.boxH,
      descX: L.descLeft,
      descTop,
      descLineH: L.descLineH,
      blockBottom: bottom,
    })
    bottom = descTop - L.skillGap
  }
  const contentTop = layoutRows[0].descTop
  const bandTop = Math.max(0, contentTop - L.bandPadTop)
  return { rows: layoutRows, bandTop, bandBottom }
}

// 白色半透明底：画在武将图之上、势力卡框之下
function drawSkillBand(ctx, card, band) {
  if (!band.rows.length) return
  const { bandTop, bandBottom } = band
  ctx.save()
  const grad = ctx.createLinearGradient(0, bandTop, 0, bandBottom)
  grad.addColorStop(0, 'rgba(226,222,214,0.66)')
  grad.addColorStop(0.14, 'rgba(226,222,214,0.82)')
  grad.addColorStop(1, 'rgba(226,222,214,0.9)')
  ctx.fillStyle = grad
  ctx.fillRect(0, bandTop, CARD_W, bandBottom - bandTop)
  ctx.restore()
}

// 技能框 + 技能名 + 描述：画在势力卡框之上（最上层）
function drawSkillContent(ctx, card, assets, rows) {
  if (!rows.length) return
  const L = LAYOUT
  const box = assets.boxes[card.faction]
  ctx.save()
  ctx.textBaseline = 'middle'
  for (const r of rows) {
    // 技能框图片
    if (box) {
      const bw = r.boxW
      const bh = r.boxH
      const bx = r.boxX
      const by = r.boxY
      ctx.drawImage(box, bx, by, bw, bh)
      // 技能名（在框内居中偏左）
      ctx.save()
      withFont(ctx, BRUSH_FONT, L.skillNameFont)
      ctx.textAlign = 'center'
      fillText(ctx, r.name, bx + bw * 0.44, by + bh / 2 + 2, '#3a2410', 'rgba(255,246,220,0.55)', 4)
      ctx.restore()
    }
    // 描述文本
    ctx.save()
    withFont(ctx, DESC_FONT, L.descFont)
    ctx.textAlign = 'left'
    for (let li = 0; li < r.lines.length; li++) {
      const y = r.descTop + r.descLineH * li + r.descLineH / 2
      ctx.fillStyle = '#20211f'
      ctx.fillText(r.lines[li], r.descX, y)
    }
    ctx.restore()
  }
  ctx.restore()
}

function drawTitle(ctx, card) {
  const L = LAYOUT
  if (!card.title) return
  drawVerticalText(ctx, card.title, card.layout.title.x, card.layout.title.y, L.titleFont, L.titleColor, L.textOutline, L.outlineWidth)
}

function drawName(ctx, card) {
  const L = LAYOUT
  if (!card.name) return
  drawVerticalText(ctx, card.name, card.layout.name.x, card.layout.name.y, L.nameFont, L.nameColor, L.textOutline, L.outlineWidth)
}

// 命中框（供手势判断）
function textBBox(card, key) {
  const L = LAYOUT
  const font = key === 'name' ? L.nameFont : L.titleFont
  const step = font * 1.16
  const text = key === 'name' ? card.name : card.title
  const t = card.layout[key]
  const pad = font * 0.5
  return {
    x0: t.x - font / 2 - pad,
    x1: t.x + font / 2 + pad,
    y0: t.y - pad,
    y1: t.y + Math.max(text.length, 1) * step + pad,
  }
}
export function nameBBox(card) { return textBBox(card, 'name') }
export function titleBBox(card) { return textBBox(card, 'title') }

export function renderCard(ctx, card, assets, opts = {}) {
  ctx.clearRect(0, 0, CARD_W, CARD_H)
  ctx.fillStyle = opts.background || '#0b0a09'
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  drawImage(ctx, card, assets) // 底层：武将图
  const band = computeSkills(ctx, card)
  drawSkillBand(ctx, card, band) // 白色透明底：武将图之上、势力卡框之下
  drawPlate(ctx, card, assets) // 势力卡框
  drawGems(ctx, card, assets)
  drawSkillContent(ctx, card, assets, band.rows) // 技能框/技能名/描述：最上层
  drawTitle(ctx, card)
  drawName(ctx, card)
  if (opts.debug) {
    ctx.save()
    ctx.strokeStyle = 'rgba(0,255,120,0.8)'
    ctx.lineWidth = 3
    for (const bb of [nameBBox(card), titleBBox(card)]) {
      ctx.strokeRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0)
    }
    ctx.restore()
  }
}
