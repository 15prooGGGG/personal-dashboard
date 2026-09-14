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
const img = context.getImageData(0, 0, W, H)
function px(x, y) {
  const i = (Math.round(y) * W + Math.round(x)) * 4
  return [img.data[i], img.data[i+1], img.data[i+2]]
}
console.log('size', W, H)
console.log('sample header px (203,175):', px(203,175))
console.log('sample header px (1500,175):', px(1500,175))
console.log('sample white bg px (100,100):', px(100,100))

// find column gap: scan a horizontal row near top content area (y=170) across full width,
// look for a wide contiguous white run in the middle
const y = 400
let run = [], best = null
for (let x = 0; x < W; x++) {
  const [r,g,b] = px(x,y)
  const white = r>240 && g>240 && b>240
  if (white) {
    if (!run.length) run = [x,x]
    else run[1] = x
  } else {
    if (run.length && x > W*0.3 && x < W*0.7) {
      const width = run[1]-run[0]
      if (!best || width > (best[1]-best[0])) best = run
    }
    run = []
  }
}
console.log('widest white run near middle at y=400:', best)
