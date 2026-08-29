const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const FFMPEG = 'D:\\ffmpeg\\ffmpeg-7.0.2-essentials_build\\bin\\ffmpeg.exe'
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, '素材')
const OUT = path.join(ROOT, 'public', 'assets', 'slices')
fs.mkdirSync(OUT, { recursive: true })

// 由分析脚本得到的 bounding box；row.x0,x1,y0,y1
// 每个元素再外扩 pad，确保带出阴影但不串到相邻行
const rows = [
  { fx: 'wei', box: [71, 269, 66, 143], gem: [344, 396, 74, 136] },
  { fx: 'shu', box: [71, 270, 166, 243], gem: [343, 396, 172, 235] },
  { fx: 'wu', box: [71, 270, 266, 343], gem: [341, 395, 272, 336] },
  { fx: 'qun', box: [71, 270, 366, 444], gem: [342, 395, 378, 441] },
  { fx: 'jin', box: [70, 270, 566, 644], gem: [344, 396, 574, 636] },
]
const PAD = 6
const W = 431
const H = 740

function cropRect([x0, x1, y0, y1]) {
  const cx0 = Math.max(0, x0 - PAD)
  const cy0 = Math.max(0, y0 - PAD)
  const cx1 = Math.min(W - 1, x1 + PAD)
  const cy1 = Math.min(H - 1, y1 + PAD)
  return { x: cx0, y: cy0, w: cx1 - cx0 + 1, h: cy1 - cy0 + 1 }
}

function slice(src, out, rect, name) {
  const { x, y, w, h } = rect
  execFileSync(FFMPEG, [
    '-y', '-i', src,
    '-vf', `crop=${w}:${h}:${x}:${y}`,
    path.join(OUT, name),
  ], { stdio: 'inherit' })
  console.log(`crop ${name}: ${w}x${h} @(${x},${y})`)
}

const misc = path.join(SRC, 'miscellaneous.png')
for (const r of rows) {
  slice(misc, null, cropRect(r.box), `skillbox_${r.fx}.png`)
  slice(misc, null, cropRect(r.gem), `gem_${r.fx}.png`)
}

// 拷贝势力立板与成品参考进 assets，便于统一由 web 伺服
for (const fx of ['wei', 'shu', 'wu', 'qun', 'jin']) {
  fs.copyFileSync(path.join(SRC, `${fx}.png`), path.join(OUT, `plate_${fx}.png`))
}
fs.copyFileSync(path.join(SRC, '成品展示.jpg'), path.join(ROOT, 'public', 'assets', 'reference.jpg'))

console.log('done ->', OUT)
