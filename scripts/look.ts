// Drives the app in headless Chromium, for a look at a change: starts the dev
// server, opens the app on a fresh profile, runs the steps read from stdin,
// and prints where each image went and the page's errors.
// Run: npx tsx scripts/look.ts [out-dir] < steps.js
// The steps and their helpers: .claude/skills/look/SKILL.md
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { CARD_H, CARD_W } from '../src/core/units.ts'

/** mm from the card's top-left corner */
interface Region {
  x: number
  y: number
  w: number
  h: number
}

interface CardOptions {
  region?: Region
  /** px per mm; by default the image's long side is 1000 px */
  scale?: number
  name?: string
}

type Steps = (...helpers: unknown[]) => Promise<void>
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...params: string[]
) => Steps

const root = path.resolve(import.meta.dirname, '..')
const outDir = path.resolve(process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'look-')))
fs.mkdirSync(outDir, { recursive: true })
const steps = (process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8')).trim() || 'await shot()'

const server = await createServer({ root, logLevel: 'error', server: { port: 0 } })
await server.listen()
const base = server.config.base
const url = server.resolvedUrls!.local[0]

const errors: string[] = []
const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
  })
  // the card renders get their own page, at 1 px per CSS px
  const cardPage = await browser.newPage()
  for (const p of [page, cardPage]) {
    p.on('pageerror', (e) => errors.push(String(e)))
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
  }

  let shots = 0
  /** the page, or the first element matching `selector` */
  const shot = async (selector?: string, name = `shot-${++shots}.png`): Promise<string> => {
    const file = path.join(outDir, name)
    if (selector) await page.locator(selector).first().screenshot({ path: file })
    else await page.screenshot({ path: file })
    console.log(`shot: ${file}`)
    return file
  }

  let cards = 0
  /** a spec, rendered from the SVG the PNG export draws, at any scale */
  const card = async (yaml: string, opts: CardOptions = {}): Promise<string> => {
    const svg: string = await page.evaluate(
      async ({ module, yaml }) => {
        const { exportSvg, layoutFromText } = await import(module)
        return exportSvg(layoutFromText(yaml, 'card'))
      },
      { module: `${base}src/app/export/exportCommon.ts`, yaml },
    )
    const { x, y, w, h } = opts.region ?? { x: 0, y: 0, w: CARD_W, h: CARD_H }
    const scale = opts.scale ?? 1000 / Math.max(w, h)
    const framed = svg.replace(
      /^<svg ([^>]*)viewBox="[^"]*" width="[^"]*" height="[^"]*"/,
      `<svg $1viewBox="${x} ${y} ${w} ${h}" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}"`,
    )
    if (framed === svg)
      throw new Error("exportSvg()'s root tag changed shape: update card() in look.ts")
    const file = path.join(outDir, opts.name ?? `card-${++cards}.png`)
    await cardPage.setContent(`<body style="margin:0">${framed}</body>`)
    await cardPage.locator('body > svg').screenshot({ path: file })
    console.log(`card: ${file}`)
    return file
  }

  const read = (file: string): string => fs.readFileSync(file, 'utf8')

  await page.goto(url)
  await page.waitForSelector('.app-shell')
  await new AsyncFunction('page', 'shot', 'card', 'read', steps)(page, shot, card, read)
} finally {
  console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors')
  await browser.close()
  await server.close()
}
