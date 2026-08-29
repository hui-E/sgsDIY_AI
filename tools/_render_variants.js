const fs = require('fs')
const os = require('os')
const PW = 'C:/Users/HUIE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
const { chromium } = require(PW)

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 500, height: 1000 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))
  await page.goto('http://localhost:5173/?demo', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForFunction(() => window.__SGS__ && window.__SGS__.state, null, { timeout: 30000 })

  const variants = [
    { name: 'default-hp3-2skills', setup: () => {} },
    {
      name: 'hp10-1skill',
      setup: () => {
        window.__SGS__.state.card.hp = 10
        window.__SGS__.state.card.skills = [{ name: '离间', desc: '出牌阶段限一次，你可以弃置一张牌并选择两名男性角色，令其中一名男性角色视为对另一名男性角色使用一张【决斗】。' }]
      },
    },
    {
      name: 'hp9-2skill',
      setup: () => {
        window.__SGS__.state.card.hp = 9
        window.__SGS__.state.card.skills = [
          { name: '离间', desc: '出牌阶段限一次，你可以弃置一张牌并选择两名男性角色，令其中一名男性角色视为对另一名男性角色使用一张【决斗】。' },
          { name: '闭月', desc: '结束阶段，你可以摸一张牌。' },
        ]
      },
    },
    {
      name: 'hp5-3skill',
      setup: () => {
        window.__SGS__.state.card.hp = 5
        window.__SGS__.state.card.skills = [
          { name: '强识', desc: '出牌阶段，你可以观看牌堆顶的一张牌，然后获得之。' },
          { name: '集智', desc: '当你使用普通锦囊牌时，你可以摸一张牌。若此牌是装备牌，你额外摸一张牌。' },
          { name: '空城', desc: '锁定技，若你没有手牌，你不能成为【杀】或【决斗】的目标。' },
        ]
      },
    },
  ]

  for (const v of variants) {
    await page.evaluate(v.setup)
    const dataUrl = await page.evaluate(async () => {
      const blob = await window.__SGS__.renderPNG()
      return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
    })
    const base64 = dataUrl.split(',')[1]
    const out = os.tmpdir() + '/sgs-variant-' + v.name + '.png'
    fs.writeFileSync(out, Buffer.from(base64, 'base64'))
    console.log('wrote', out)
  }

  await browser.close()
})().catch((e) => { console.error('FAILED:', e); process.exit(1) })
