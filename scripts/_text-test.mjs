import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const doc = await getDocument({ url: 'data/loesungsbuch.pdf' }).promise
const page = await doc.getPage(11)
const tc = await page.getTextContent()
console.log('numItems', tc.items.length)
console.log(tc.items.slice(0, 20).map(i => i.str))
