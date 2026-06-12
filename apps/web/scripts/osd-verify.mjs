import { createWorker } from 'tesseract.js'
import sharp from 'sharp'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><rect width="1000" height="600" fill="white"/><text x="60" y="180" font-size="54" font-family="DejaVu Sans, Arial">DOCUMENT TEXT SAMPLE</text><text x="60" y="300" font-size="54" font-family="DejaVu Sans, Arial">Hello World 12345 ABCDEF</text><text x="60" y="420" font-size="54" font-family="DejaVu Sans, Arial">The quick brown fox jumps</text></svg>`
const upright = await sharp(Buffer.from(svg)).png().toBuffer()
const worker = await createWorker('osd', 0, { legacyCore: true, legacyLang: true })
for (const [name, deg] of [['upright',0],['rot90',90],['rot180',180],['rot270',270]]) {
  const buf = deg ? await sharp(upright).rotate(deg).png().toBuffer() : upright
  const { data } = await worker.detect(buf)
  console.log(`${name.padEnd(8)} -> orientation_degrees=${data.orientation_degrees}  confidence=${data.orientation_confidence}`)
}
await worker.terminate()
console.log('OSD verify done')
