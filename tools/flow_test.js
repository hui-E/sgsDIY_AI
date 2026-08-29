const fs = require('fs')
const os = require('os')
const PW = 'C:/Users/HUIE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
const { chromium } = require(PW)

const BASE = 'http://localhost:5173'
const OUT = os.tmpdir()

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg)
  console.log('  ok -', msg)
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 1 })
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()) })
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForFunction(() => window.__SGS__ && window.__SGS__.state, null, { timeout: 30000 })

  console.log('\n== 阶段一：编辑表单 ==')
  assert(await page.isVisible('#edit-view'), '编辑页可见')
  assert(await page.isHidden('#layout-view'), '排版页初始隐藏')

  const factions = await page.$$eval('#faction .faction-btn', (els) => els.map((e) => e.dataset.faction))
  assert(factions.join(',') === 'wei,shu,wu,qun,jin', '势力五选一：' + factions.join(','))
  const def = await page.evaluate(() => ({ name: window.__SGS__.state.card.name, hp: window.__SGS__.state.card.hp, skills: window.__SGS__.state.card.skills.length }))
  assert(def.name === '貂蝉' && def.hp === 3 && def.skills === 2, `默认值 name=${def.name} hp=${def.hp} skills=${def.skills}`)

  // 血量上下限
  await page.fill('#hp', '99')
  await page.dispatchEvent('#hp', 'input')
  let hp = await page.evaluate(() => window.__SGS__.state.card.hp)
  assert(hp === 10, '血量上限 10（输入99→10）')
  await page.fill('#hp', '-5')
  await page.dispatchEvent('#hp', 'input')
  hp = await page.evaluate(() => window.__SGS__.state.card.hp)
  assert(hp === 0, '血量下限 0（输入-5→0）')

  // 技能增删 1..3
  await page.click('#add-skill')
  let n = await page.$$eval('.skill-card', (e) => e.length)
  assert(n === 3, '新增1个技能 → 3')
  assert(await page.isDisabled('#add-skill'), '达上限3时新增按钮禁用')
  await page.click('.skill-card:nth-child(3) .skill-del')
  await page.click('.skill-card:nth-child(2) .skill-del')
  n = await page.$$eval('.skill-card', (e) => e.length)
  assert(n === 1, '删除2个 → 只剩1')
  assert(await page.isDisabled('.skill-card:nth-child(1) .skill-del'), '只剩1时删除按钮禁用')

  // 恢复成 2 个技能（可编辑、可验证多个渲染）
  await page.click('#add-skill')
  await page.fill('.skill-card:nth-child(1) input', '强识')
  await page.fill('.skill-card:nth-child(1) textarea', '出牌阶段，你可以观看牌堆顶的一张牌，然后获得之。')
  await page.fill('.skill-card:nth-child(2) input', '集智')
  await page.fill('.skill-card:nth-child(2) textarea', '当你使用普通锦囊牌时，你可以摸一张牌。')

  // 选择势力 吴
  await page.click('.faction-btn[data-faction="wu"]')
  let fx = await page.evaluate(() => window.__SGS__.state.card.faction)
  assert(fx === 'wu', '选择势力 → 吴')

  // 上传图片
  await page.setInputFiles('#file', 'D:/projects/sgsDIY_AI/public/assets/demo-portrait.jpg')
  await page.waitForFunction(() => window.__SGS__.state.card.image != null, null, { timeout: 10000 })
  assert(await page.isVisible('#image-preview'), '选图后预览可见')
  assert(await page.evaluate(() => window.__SGS__.state.card.imageSrc != null), 'imageSrc 已设置')

  await page.screenshot({ path: OUT + '/flow-edit.png', fullPage: true })
  console.log('  截图 flow-edit.png')

  console.log('\n== 阶段二：排版 ==')
  await page.click('#next')
  await page.waitForFunction(() => !document.querySelector('#layout-view').classList.contains('hidden'), null, { timeout: 5000 })
  assert(await page.isHidden('#edit-view'), '排版页显示、编辑页隐藏')

  // 拖动名称（卡片坐标点转换到页面坐标）
  const moveName = async (dx, dy, startCard) => {
    const rect = await page.evaluate(() => {
      const r = document.querySelector('#card').getBoundingClientRect()
      return { left: r.left, top: r.top, width: r.width, height: r.height }
    })
    const sx = rect.left + (startCard.x / 1425) * rect.width
    const sy = rect.top + (startCard.y / 2048) * rect.height
    const ex = sx + (dx / 1425) * rect.width
    const ey = sy + (dy / 2048) * rect.height
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    await page.mouse.move(ex, ey, { steps: 8 })
    await page.mouse.up()
  }

  const before = await page.evaluate(() => ({ name: { ...window.__SGS__.state.card.layout.name }, img: { ...window.__SGS__.state.card.layout.image } }))
  await moveName(60, -80, { x: 116, y: 1050 })
  const after = await page.evaluate(() => ({ name: { ...window.__SGS__.state.card.layout.name } }))
  assert(Math.abs(after.name.x - before.name.x - 60) < 12, `拖动名称 x 移动 ~60（实际 ${(after.name.x - before.name.x).toFixed(0)}）`)
  assert(Math.abs(after.name.y - before.name.y + 80) < 12, `拖动名称 y 移动 ~-80（实际 ${(after.name.y - before.name.y).toFixed(0)}）`)

  // 拖动武将图
  await moveName(40, 30, { x: 800, y: 700 })
  const imgAfter = await page.evaluate(() => ({ ...window.__SGS__.state.card.layout.image }))
  assert(Math.abs(imgAfter.x - before.img.x - 40) < 15, `拖动武将图 x 移动 ~40（实际 ${(imgAfter.x - before.img.x).toFixed(0)}）`)
  assert(Math.abs(imgAfter.y - before.img.y - 30) < 15, `拖动武将图 y 移动 ~30（实际 ${(imgAfter.y - before.img.y).toFixed(0)}）`)

  // 滚轮缩放图片（模拟双指缩放 近似）
  const rect = await page.evaluate(() => {
    const r = document.querySelector('#card').getBoundingClientRect()
    return { left: r.left, top: r.top, width: r.width, height: r.height }
  })
  const zx = rect.left + (800 / 1425) * rect.width
  const zy = rect.top + (700 / 2048) * rect.height
  const scaleBefore = await page.evaluate(() => window.__SGS__.state.card.layout.image.scale)
  await page.mouse.move(zx, zy)
  await page.mouse.wheel(0, -600)
  const scaleAfter = await page.evaluate(() => window.__SGS__.state.card.layout.image.scale)
  assert(scaleAfter > scaleBefore, `滚轮放大 scale ${scaleBefore.toFixed(2)}→${scaleAfter.toFixed(2)}`)

  await page.screenshot({ path: OUT + '/flow-layout.png', fullPage: true })
  console.log('  截图 flow-layout.png')

  // 保存导出并校验尺寸
  const [w, h] = await page.evaluate(async () => {
    const blob = await window.__SGS__.renderPNG()
    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
    const img = new Image()
    await new Promise((res) => { img.onload = res; img.src = dataUrl })
    window.__EXPORT_URL__ = dataUrl
    return [img.width, img.height]
  })
  assert(w === 1425 && h === 2048, `导出尺寸 ${w}x${h}`)

  // 返回编辑，数据保留
  await page.click('#back')
  assert(await page.isVisible('#edit-view'), '返回后编辑页可见')
  const kept = await page.evaluate(() => ({ name: window.__SGS__.state.card.name, faction: window.__SGS__.state.card.faction, skills: window.__SGS__.state.card.skills.length }))
  assert(kept.name === '貂蝉' && kept.faction === 'wu' && kept.skills === 2, `返回保留数据 name=${kept.name} fx=${kept.faction} skills=${kept.skills}`)

  await browser.close()
  console.log('\nALL FLOW TESTS PASSED')
})().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1) })
