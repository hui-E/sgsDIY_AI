import { CARD_W, CARD_H } from './data.js'
import { renderCard } from './render.js'

export async function renderCardImage(card, assets, type = 'image/png', quality) {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  renderCard(ctx, card, assets, { forExport: true })
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function renderPNG(card, assets) {
  return renderCardImage(card, assets, 'image/png')
}

export function downloadBlob(blob, filename = 'sanguosha-general.png') {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function baseNameFor(card) {
  const safe = (s) => (s || 'general').replace(/[\\/:*?"<>|]/g, '_')
  return `三国杀_${safe(card.name)}`
}

export function filenameFor(card, ext = 'png') {
  return `${baseNameFor(card)}.${ext}`
}

export async function shareBlob(blob, filename, type = 'image/png') {
  const file = new File([blob], filename, { type })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return true
    } catch (e) {
      if (e && e.name === 'AbortError') return true
    }
  }
  return false
}