// 从成品参考图量出卡面关键元素的位置（relative 0..1）
const fs = require('fs')
const { execFileSync } = require('child_process')
const W = 739, H = 1064
const src = 'public/assets/reference.jpg'
execFileSync('D:\\ffmpeg\\ffmpeg-7.0.2-essentials_build\\bin\\ffmpeg.exe', ['-y', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'tmp/ref.rgb'], { stdio: 'ignore' })
const b = fs.readFileSync('tmp/ref.rgb')
const px = (x, y) => {
  const i = (y * W + x) * 3
  return [b[i], b[i + 1], b[i + 2]]
}
const lum = (x, y) => { const [r, g, bl] = px(x, y); return 0.299 * r + 0.587 * g + 0.114 * bl }

// 1) 左侧立板右边界：在 y=400（中部）从左向右扫，找面板亮色→暗背景 的边界
function panelRightAt(y) {
  // 立板是红色/米色，亮度偏高；右侧人物图暗背景
  for (let x = 0; x < W; x++) {
    const [r, g, bl] = px(x, y)
    // 面板大体是暖色且亮度>60；找第一个亮度跌落
    if (x > 30 && (r + g + bl) / 3 > 60) {
      // 继续，找到明显变暗（暗背景）的点
      let dark = -1
      for (let xx = x; xx < Math.min(W, x + 120); xx++) {
        if (lum(xx, y) < 30) { dark = xx; break }
      }
      if (dark > 0) return dark
    }
  }
  return -1
}
// 采样几行找面板宽度（避开文字/徽记/技能带）
for (const y of [300, 700, 950]) console.log('panelRight y=' + y, '->', panelRightAt(y))

function brightRows(x0, x1, thresh) {
  const segs = []
  let s = -1
  for (let y = 0; y < H; y++) {
    let on = false
    for (let x = x0; x <= x1; x++) if (lum(x, y) > thresh) { on = true; break }
    if (on && s < 0) s = y
    if (!on && s >= 0) { segs.push([s, y - 1]); s = -1 }
  }
  if (s >= 0) segs.push([s, H - 1])
  return segs.filter(([a, bb]) => bb - a > 4)
}

// 2) 称号/名称：扫左侧面板文字区（x 35..95），找白色亮字
console.log('left text bright segments (x35..95):', brightRows(35, 95, 150))

// 3) 勾玉：扫顶部 y40..150 全宽亮字
console.log('gems bright segments (y direction, x250..430):')
{
  const segs = []
  let s = -1
  for (let y = 0; y < 200; y++) {
    let on = false
    for (let x = 220; x < 460; x++) if (lum(x, y) > 180) { on = true; break }
    if (on && s < 0) s = y
    if (!on && s >= 0) { segs.push([s, y - 1]); s = -1 }
  }
  if (s >= 0) segs.push([s, 199])
  console.log(segs)
}

// 4) 技能带：找浅灰横带（亮度均匀偏高，覆盖整宽），用 y 方向扫中部 x=360
{
  const segs = []
  let s = -1
  for (let y = 0; y < H; y++) {
    const l = lum(360, y)
    const on = l > 150 && l < 240
    if (on && s < 0) s = y
    if (!on && s >= 0) { if (y - s > 30) segs.push([s, y - 1]); s = -1 }
  }
  if (s >= 0) segs.push([s, H - 1])
  console.log('skill band segment (x360, light grey):', segs)
}

// 5) 技能框纵向位置：扫左侧 x 28..95 找彩色横幅（红/金色，非灰）
{
  const segs = []
  let s = -1
  for (let y = 0; y < H; y++) {
    let on = false
    for (let x = 25; x < 100; x++) {
      const [r, g, bl] = px(x, y)
      if (r > 140 && r - bl > 40) { on = true; break } // 红/暖彩色横幅
    }
    if (on && s < 0) s = y
    if (!on && s >= 0) { if (y - s > 8) segs.push([s, y - 1]); s = -1 }
  }
  if (s >= 0) segs.push([s, H - 1])
  console.log('skill banner vertical segments:', segs)
}
