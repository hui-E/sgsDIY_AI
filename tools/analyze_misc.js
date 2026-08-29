// 分析 miscellaneous.png 的行/列占用，找出每行技能框与勾玉的包围盒
const fs = require('fs')

const W = 431
const H = 740
const buf = fs.readFileSync('tmp/misc.rgba')

function alpha(x, y) {
  const i = (y * W + x) * 4 + 3
  return buf[i]
}

// 每行的不透明像素数（粗略判断哪些行有内容）
const rowCount = new Array(H).fill(0)
for (let y = 0; y < H; y++) {
  let c = 0
  for (let x = 0; x < W; x++) if (alpha(x, y) > 20) c++
  rowCount[y] = c
}

// 有内容的行段
const rowSegs = []
let start = -1
for (let y = 0; y < H; y++) {
  const on = rowCount[y] > 2
  if (on && start < 0) start = y
  if (!on && start >= 0) { rowSegs.push([start, y - 1]); start = -1 }
}
if (start >= 0) rowSegs.push([start, H - 1])

console.log('行数段:', rowSegs.length)
rowSegs.forEach((s, idx) => console.log(`  段${idx}: y=${s[0]}..${s[1]} h=${s[1] - s[0] + 1}`))

// 对每个行段，找列占用分组（左框 / 右勾玉）
rowSegs.forEach((seg, idx) => {
  const [y0, y1] = seg
  const colCount = new Array(W).fill(0)
  for (let x = 0; x < W; x++) {
    let c = 0
    for (let y = y0; y <= y1; y++) if (alpha(x, y) > 20) c++
    colCount[x] = c
  }
  const colSegs = []
  let s = -1
  for (let x = 0; x < W; x++) {
    const on = colCount[x] > 2
    if (on && s < 0) s = x
    if (!on && s >= 0) { colSegs.push([s, x - 1]); s = -1 }
  }
  if (s >= 0) colSegs.push([s, W - 1])
  // 合并过近的列段（一个图形内部可能有细微透明gap）
  const merged = []
  for (const seg2 of colSegs) {
    if (merged.length && seg2[0] - merged[merged.length - 1][1] <= 3) {
      merged[merged.length - 1][1] = seg2[1]
    } else merged.push([...seg2])
  }
  console.log(`\n[行 ${idx}] y=${y0}..${y1}`)
  merged.forEach((cs, ci) => {
    const [x0, x1] = cs
    // 在该列段内求实际 y 包围盒
    let yy0 = y1, yy1 = y0
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (alpha(x, y) > 20) { if (y < yy0) yy0 = y; if (y > yy1) yy1 = y; break }
      }
    }
    console.log(`  组${ci}: x=${x0}..${x1} w=${x1 - x0 + 1}  y=${yy0}..${yy1} h=${yy1 - yy0 + 1}`)
  })
})
