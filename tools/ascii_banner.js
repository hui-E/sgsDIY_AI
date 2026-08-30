// ASCII 可视化参考图横幅区域（x 10..150, y 806..900），确认技能名字体大小
const fs = require('fs')
const { execFileSync } = require('child_process')
const W = 739, H = 1064
execFileSync('D:\\ffmpeg\\ffmpeg-7.0.2-essentials_build\\bin\\ffmpeg.exe', ['-y', '-i', 'public/assets/reference.jpg', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'tmp/ref.rgb'], { stdio: 'ignore' })
const b = fs.readFileSync('tmp/ref.rgb')
const lum = (x, y) => { const i = (y * W + x) * 3; return 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2] }
const [x0, x1, y0, y1] = [10, 150, 800, 905]
for (let y = y0; y <= y1; y++) {
  let row = ''
  for (let x = x0; x <= x1; x++) {
    const l = lum(x, y)
    row += l < 115 ? '#' : (l < 150 ? 'o' : (l < 190 ? '+' : '.'))
  }
  console.log(String(y).padEnd(4) + row)
}
