// ===========================================================================
// Gemalte Rahmen für die Startseiten-Bühne.
// ---------------------------------------------------------------------------
// Jeder Screen sitzt auf einem eigenen „Pinselbild“ (wie bei OpenDesign).
// Die Bilder werden einmal per Canvas erzeugt (Verlauf + ~500 halbtrans-
// parente Pinselstriche + Korn) und als JPEG-Data-URL gecacht. Gleicher
// Seed = gleiches Bild, damit die Rahmen nicht bei jedem Laden anders aussehen.
// ===========================================================================

export interface Palette {
  sky: [string, string, string]
  strokes: string[]
  tilt: number
}

const P = (sky: Palette['sky'], strokes: string[], tilt: number): Palette => ({ sky, strokes, tilt })

// Je Bereich mehrere Paletten, damit jeder Rahmen seine eigenen Farben hat.
export const PALETTES: Record<string, Palette[]> = {
  body: [
    P(['#bfe9e0', '#6fd3c0', '#2e9e8f'], ['#ffffff', '#9ff0dc', '#3cc4a8', '#1e7f72', '#d7f7ee', '#6aa6ff'], 0.1),
    P(['#dfe7ff', '#a9b8ff', '#6f7fe0'], ['#ffffff', '#c9d3ff', '#8c9cff', '#5a63c9', '#f3e6ff', '#9fe3d6'], -0.1)
  ],
  school: [
    P(['#ffd7a8', '#ff8f6b', '#d9435c'], ['#fff1d6', '#ffb56b', '#ff6a4d', '#c23a5a', '#ffd9b8', '#7a3a8c'], -0.15),
    P(['#fff2c2', '#ffd36b', '#e89a2c'], ['#ffffff', '#ffe39a', '#ffc04d', '#d9822b', '#fff7dd', '#ff9f7a'], 0.12),
    P(['#ffe0e6', '#ff9fb4', '#e0577a'], ['#ffffff', '#ffc6d3', '#ff7f9e', '#c23f63', '#fff0f3', '#ffb38a'], -0.05)
  ],
  money: [
    P(['#cfe0ff', '#7aa2ff', '#2f4fd6'], ['#ffffff', '#b8ceff', '#5b7fff', '#2a3fae', '#e6eeff', '#9ad7ff'], 0.05),
    P(['#ffe9d6', '#ffbf8f', '#f08a5d'], ['#ffffff', '#ffd9b8', '#ffa97a', '#e0754a', '#fff3e8', '#9ad7ff'], -0.12)
  ],
  projects: [
    P(['#f3d6ff', '#c58ce8', '#7a3fa8'], ['#ffffff', '#f0c2ff', '#b36be0', '#6c2f96', '#ffd6ec', '#ff9ac2'], -0.08),
    P(['#ffe3ef', '#ff9fc6', '#d9558f'], ['#ffffff', '#ffc7de', '#ff7fb0', '#b8437a', '#fff0f6', '#c9a2ff'], 0.1)
  ],
  agenda: [
    P(['#e6f5c9', '#9fd36b', '#4f9a3a'], ['#ffffff', '#d7f2a8', '#8cc95a', '#3f7f2f', '#fff3b8', '#6fc2a8'], 0.12),
    P(['#fff8d6', '#ffe27a', '#d9b23a'], ['#ffffff', '#fff0a8', '#ffd34d', '#b8902a', '#fffbe6', '#a8d98a'], -0.1)
  ]
}

const rnd = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

function render(pal: Palette, seed: number, w = 640, h = 480): string {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const b = c.getContext('2d')
  if (!b) return ''
  const r = rnd(seed)
  const g = b.createLinearGradient(0, 0, w * 0.3, h)
  g.addColorStop(0, pal.sky[0])
  g.addColorStop(0.55, pal.sky[1])
  g.addColorStop(1, pal.sky[2])
  b.fillStyle = g
  b.fillRect(0, 0, w, h)
  for (let i = 0; i < 520; i++) {
    const y = r() * h
    const col = pal.strokes[Math.floor(((y / h) * 0.6 + r() * 0.6) * pal.strokes.length) % pal.strokes.length]
    b.save()
    b.translate(r() * w, y)
    b.rotate((r() - 0.5) * 0.5 + pal.tilt)
    b.globalAlpha = 0.08 + r() * 0.28
    b.fillStyle = col
    const sw = 30 + r() * 200
    const sh = 5 + r() * 26
    b.beginPath()
    b.ellipse(0, 0, sw, sh, 0, 0, Math.PI * 2)
    b.fill()
    // Borsten: feine Linien im Strich – das macht ihn „gemalt“.
    b.globalAlpha *= 0.85
    b.strokeStyle = col
    b.lineWidth = 1.1
    for (let k = 0; k < 4; k++) {
      const oy = (r() - 0.5) * sh * 1.5
      b.beginPath()
      b.moveTo(-sw * 0.85, oy)
      b.quadraticCurveTo(0, oy + (r() - 0.5) * 6, sw * 0.85, oy)
      b.stroke()
    }
    b.restore()
  }
  const img = b.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 18
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  b.putImageData(img, 0, 0)
  return c.toDataURL('image/jpeg', 0.85)
}

const cache = new Map<string, string>()

/** Gemalter Rahmen für Bereich `area`, Karte Nr. `index` (gecacht). */
export function paintFor(area: string, index: number): string {
  const key = `${area}-${index}`
  let url = cache.get(key)
  if (!url) {
    const pals = PALETTES[area] ?? PALETTES.body
    const seed = 11 + [...area].reduce((a, ch) => a + ch.charCodeAt(0), 0) + index * 7
    url = render(pals[index % pals.length], seed)
    cache.set(key, url)
  }
  return url
}
