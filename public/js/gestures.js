import { CARD_W, CARD_H } from './data.js'
import { nameBBox, titleBBox } from './render.js'

const IMG_MIN_SCALE = 0.2
const IMG_MAX_SCALE = 6

export function attachGestures({ canvas, getCard, onUpdate, onTool }) {
  const pointers = new Map()
  let drag = null       // {target, start, startX, startY}
  let pinch = null      // {cx, cy, scale, dist, mid}

  function toCard(clientX, clientY) {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return { x: 0, y: 0 }
    return {
      x: (clientX - r.left) * (CARD_W / r.width),
      y: (clientY - r.top) * (CARD_H / r.height),
    }
  }

  function pickTarget(pt, card) {
    // 若工具栏锁定名称/称号，优先该元素
    const tool = onTool()
    if (tool === 'name' && card.name) return 'name'
    if (tool === 'title' && card.title) return 'title'
    const nb = nameBBox(card)
    const tb = titleBBox(card)
    if (card.name && pt.x >= nb.x0 && pt.x <= nb.x1 && pt.y >= nb.y0 && pt.y <= nb.y1) return 'name'
    if (card.title && pt.x >= tb.x0 && pt.x <= tb.x1 && pt.y >= tb.y0 && pt.y <= tb.y1) return 'title'
    return 'image'
  }

  function setCursor(mode) {
    canvas.classList.remove('dragging', 'cursor-move', 'cursor-zoom')
    if (mode === 'drag') canvas.classList.add('cursor-move')
  }

  function pointerDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  function pointerMid(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  function onPointerDown(e) {
    canvas.setPointerCapture(e.pointerId)
    const pt = toCard(e.clientX, e.clientY)
    pointers.set(e.pointerId, pt)
    const card = getCard()

    if (pointers.size === 2) {
      // 进入双指缩放（作用于武将图）
      drag = null
      const [a, b] = [...pointers.values()]
      const t = card.layout.image
      pinch = { cx: t.x, cy: t.y, scale: t.scale, dist: pointerDistance(a, b), mid: pointerMid(a, b) }
      setCursor('zoom')
      return
    }
    if (pointers.size === 1) {
      const target = pickTarget(pt, card)
      const el = card.layout[target]
      drag = { target, start: { x: el.x, y: el.y }, startX: pt.x, startY: pt.y }
      setCursor('drag')
    }
  }

  function onPointerMove(e) {
    const pt = toCard(e.clientX, e.clientY)
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, pt)
    const card = getCard()

    if (pointers.size >= 2 && pinch) {
      const [a, b] = [...pointers.values()]
      const dist = pointerDistance(a, b)
      const mid = pointerMid(a, b)
      const t = card.layout.image
      const ratio = dist / Math.max(1, pinch.dist)
      let scale = pinch.scale * ratio
      scale = Math.min(IMG_MAX_SCALE, Math.max(IMG_MIN_SCALE, scale))
      const localX = (pinch.mid.x - pinch.cx) / pinch.scale
      const localY = (pinch.mid.y - pinch.cy) / pinch.scale
      t.x = mid.x - localX * scale
      t.y = mid.y - localY * scale
      t.scale = scale
      onUpdate()
      return
    }

    if (pointers.size === 1 && drag) {
      const el = card.layout[drag.target]
      el.x = drag.start.x + (pt.x - drag.startX)
      el.y = drag.start.y + (pt.y - drag.startY)
      onUpdate()
    }
  }

  function release(e) {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinch = null
    if (pointers.size === 0) { drag = null; setCursor(null) }
  }

  function onWheel(e) {
    e.preventDefault()
    const card = getCard()
    const t = card.layout.image
    const pt = toCard(e.clientX, e.clientY)
    const delta = e.deltaY < 0 ? 1.08 : 0.92
    let scale = Math.min(IMG_MAX_SCALE, Math.max(IMG_MIN_SCALE, t.scale * delta))
    const localX = (pt.x - t.x) / t.scale
    const localY = (pt.y - t.y) / t.scale
    t.x = pt.x - localX * scale
    t.y = pt.y - localY * scale
    t.scale = scale
    onUpdate()
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
  canvas.addEventListener('lostpointercapture', release)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', release)
    canvas.removeEventListener('pointercancel', release)
    canvas.removeEventListener('lostpointercapture', release)
    canvas.removeEventListener('wheel', onWheel)
  }
}
