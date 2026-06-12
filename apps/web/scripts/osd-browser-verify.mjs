import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('about:blank')
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js' })
const out = await page.evaluate(async () => {
  const T = window.Tesseract
  // make an upright text image on a canvas
  function textCanvas() {
    const c = document.createElement('canvas'); c.width = 1000; c.height = 600
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0,0,1000,600)
    x.fillStyle = '#000'; x.font = '54px sans-serif'
    x.fillText('DOCUMENT TEXT SAMPLE', 60, 180)
    x.fillText('Hello World 12345 ABCDEF', 60, 300)
    x.fillText('The quick brown fox jumps', 60, 420)
    return c
  }
  function rotate(src, deg) {
    const swap = deg===90||deg===270
    const c = document.createElement('canvas'); c.width = swap?src.height:src.width; c.height = swap?src.width:src.height
    const x = c.getContext('2d'); x.translate(c.width/2,c.height/2); x.rotate(deg*Math.PI/180); x.drawImage(src,-src.width/2,-src.height/2)
    return c
  }
  const worker = await T.createWorker('osd', 0, { legacyCore: true, legacyLang: true })
  const up = textCanvas()
  const res = {}
  for (const deg of [0,90,180,270]) {
    const img = deg ? rotate(up, deg) : up
    const { data } = await worker.detect(img)
    res[deg] = { od: data.orientation_degrees, conf: Math.round((data.orientation_confidence||0)*100)/100 }
  }
  await worker.terminate()
  return res
})
console.log('BROWSER OSD:', JSON.stringify(out))
await browser.close()
