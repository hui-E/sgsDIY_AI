// 精确测描述行每字符的列边界（避开横幅），求 advance 与 inkH
const fs = require('fs')
const { execFileSync } = require('child_process')
const W = 739, H = 1064
execFileSync('D:\\ffmpeg\\ffmpeg-7.0.2-essentials_build\\bin\\ffmpeg.exe', ['-y', '-i', 'public/assets/reference.jpg', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'tmp/ref.rgb'], { stdio: 'ignore' })
const b = fs.readFileSync('tmp/ref.rgb')
const lum = (x, y) => { const i = (y * W + x) * 3; return 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2] }
const SCALE = 1425 / 739

function lineCols(y0, y1, x0, x1, th = 95) {
  const cols = []
  let s = -1
  for (let x = x0; x <= x1; x++) {
    let on = false
    for (let y = y0; y <= y1; y++) if (lum(x, y) < th) { on = true; break }
    if (on && s < 0) s = x
    if (!on && s >= 0) { cols.push([s, x - 1]); s = -1 }
  }
  if (s >= 0) cols.push([s, x1])
  return cols
}

const targets = [
  { y: [831, 856], label: 'line1' },
  { y: [865, 891], label: 'line2' },
  { y: [908, 933], label: 'line3' },
]
for (const t of targets) {
  const [y0, y1] = t.y
  const cols = lineCols(y0, y1, 150, W - 4)
  // 用每个"空白间隔"的中点作为字符边界：
  // 相邻 cols 之间的 gap 若 > 6px，是一个字符切割
  const merged = []
  for (const c of cols) {
    if (merged.length && c[0] - merged[merged.length - 1][1] <= 5) {
      merged[merged.length - 1][1] = c[1]
    } else merged.push(c.slice())
  }
  const ink = merged.length ? merged[merged.length - 1][1] - merged[0][0] + 1 : 0
  console.log(`${t.label} merged cols=${merged.length} first=${merged[0]} last=${merged[merged.length - 1]}`)
  console.log('   segs:', JSON.stringify(merged))
}
