const PW = 'C:/Users/HUIE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
const { chromium } = require(PW)

function assert(cond, msg) { if (!cond) throw new Error('ASSERT FAIL: ' + msg); console.log('  ok -', msg) }

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/?demo&v=8', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForFunction(() => window.__SGS__ && window.__SGS__.state.assets && window.__SGS__.state.assets.plates.shu, null, { timeout: 30000 })
  await page.evaluate(async () => { await document.fonts.ready })
  await page.waitForTimeout(300)

  const rect = await page.evaluate(() => {
    const r = document.querySelector('#card').getBoundingClientRect()
    return { left: r.left, top: r.top, width: r.width, height: r.height }
  })
  const S = await page.evaluate(() => window.__SGS__.state.card.layout.image.scale)

  // 以卡片中心为两指中点，起始距离 40，最终 110（放大）
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const cdp = await ctx.newCDPSession(page)
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: pts.map(([x, y], i) => ({ x, y, radiusX: 2, radiusY: 2, force: 1, id: i })),
  })
  await touch('touchStart', [[cx - 20, cy], [cx + 20, cy]])
  await touch('touchMove', [[cx - 55, cy], [cx + 55, cy]])
  await touch('touchEnd', [])
  await page.waitForTimeout(200)

  const E = await page.evaluate(() => window.__SGS__.state.card.layout.image.scale)
  assert(E > S, `双指外扩放大 scale ${S.toFixed(3)} -> ${E.toFixed(3)}`)

  await browser.close()
  console.log('PINCH OK')
})().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1) })
