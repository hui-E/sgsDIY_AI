const fs = require('fs')
const os = require('os')
const PW = 'C:/Users/HUIE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
const { chromium } = require(PW)

const OUT = os.tmpdir()
const SIZES = [[360, 780], [390, 844], [430, 900], [640, 900], [1280, 900]]

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const [w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    await page.goto('http://localhost:5173/?demo&v=7', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForFunction(() => window.__SGS__ && window.__SGS__.state.assets && window.__SGS__.state.assets.plates.shu, null, { timeout: 30000 })
    await page.evaluate(async () => { await document.fonts.ready })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/resp-layout-${w}x${h}.png`, fullPage: true })

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/resp-edit-${w}x${h}.png`, fullPage: true })
    await page.close()
    console.log('done', w, 'x', h)
  }
  await browser.close()
  console.log('ALL DONE')
})().catch((e) => { console.error(e); process.exit(1) })
