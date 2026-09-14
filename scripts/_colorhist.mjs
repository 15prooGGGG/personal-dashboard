import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    return { canvas, context }
  }
  reset(cc, width, height) { cc.canvas.width = width; cc.canvas.height = height }
  destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0 }
}
const factory = new NodeCanvasFactory()
const doc = await getDocument({ url: 'data/loesungsbuch.pdf', canvasFactory: factory }).promise
const page = await doc.getPage(11)
const scale = 3
const viewport = page.getViewport({ scale })
const { canvas, context } = factory.create(viewport.width, viewport.height)
await page.render({ canvasContext: context, viewport, canvasFactory: factory }).promise
const W = viewport.width, H = viewport.height
const img = context.getImageData(0, 0, W, H).data

const counts = new Map()
for (let i = 0; i < img.length; i += 4*7) { // sample every 7th pixel for speed
  const r = img[i], g = img[i+1], b = img[i+2]
  // skip near-white and near-black and grays
  if (r>235 && g>235 && b>235) continue
  if (Math.abs(r-g)<12 && Math.abs(g-b)<12 && Math.abs(r-b)<12) continue
  const key = `${r>>4},${g>>4},${b>>4}` // quantize
  counts.set(key, (counts.get(key)||0)+1)
}
const sorted = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15)
for (const [k,c] of sorted) console.log(k.split(',').map(v=>parseInt(v)*16), c)
