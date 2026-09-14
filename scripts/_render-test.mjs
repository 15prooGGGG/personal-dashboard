import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    return { canvas, context }
  }
  reset(cc, width, height) {
    cc.canvas.width = width
    cc.canvas.height = height
  }
  destroy(cc) {
    cc.canvas.width = 0
    cc.canvas.height = 0
  }
}

const doc = await getDocument({ url: 'data/loesungsbuch.pdf', canvasFactory: new NodeCanvasFactory() }).promise
console.log('numPages', doc.numPages)
const page = await doc.getPage(11)
const viewport = page.getViewport({ scale: 3 })
const factory = new NodeCanvasFactory()
const { canvas, context } = factory.create(viewport.width, viewport.height)
await page.render({ canvasContext: context, viewport, canvasFactory: factory }).promise
const buf = canvas.toBuffer('image/png')
fs.writeFileSync('/tmp/claude-1000/-home-lauri-claude-code-personal-dashboard/cbcdf034-aac3-49e5-a9b0-2a0eddb9119a/scratchpad/page11.png', buf)
console.log('width', viewport.width, 'height', viewport.height)
