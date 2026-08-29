const fs = require('fs')
const os = require('os')
const PW = 'C:/Users/HUIE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
const { chromium } = require(PW)

const OUT = os.tmpdir()
const FACTIONS = ['wei', 'shu', 'wu', 'qun', 'jin']

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1425, height: 2048 }, deviceScaleFactor: 1 })
  await page.goto('http://localhost:5173/?demo&v=6', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForFunction(() => window.__SGS__ && window.__SGS__.state.assets && window.__SGS__.state.assets.plates.shu, null, { timeout: 30000 })
  await page.evaluate(async () => { await document.fonts.ready })
  await page.waitForTimeout(400)

  for (const f of FACTIONS) {
    const b64 = await page.evaluate(async (fx) => {
      window.__SGS__.state.card.faction = fx
      window.__SGS__.state.card.hp = fx === 'jin' ? 9 : 3 // jin 用 9 检查勾玉换行
      const blob = await window.__SGS__.renderPNG()
      return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(blob) })
    }, f)
    fs.writeFileSync(`${OUT}/faction-${f}.png`, Buffer.from(b64, 'base64'))
    console.log('wrote', f)
  }
  await browser.close()
  console.log('done')
})().catch((e) => { console.error(e); process.exit(1) })
