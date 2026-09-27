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

/** the image types the preview's reference picker lists */
const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
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

  /** an SVG root's viewBox and size, for `region` of the card at `scale` */
  const frame = ({ region, scale }: CardOptions): string => {
    const { x, y, w, h } = region ?? { x: 0, y: 0, w: CARD_W, h: CARD_H }
    const s = scale ?? 1000 / Math.max(w, h)
    return `viewBox="${x} ${y} ${w} ${h}" width="${Math.round(w * s)}" height="${Math.round(h * s)}"`
  }

  /** a standalone SVG, screenshot to `file` */
  const snap = async (svg: string, file: string): Promise<void> => {
    await cardPage.setContent(`<body style="margin:0">${svg}</body>`)
    await cardPage.locator('body > svg').screenshot({ path: file })
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
    const framed = svg.replace(
      /^<svg ([^>]*)viewBox="[^"]*" width="[^"]*" height="[^"]*"/,
      `<svg $1${frame(opts)}`,
    )
    if (framed === svg)
      throw new Error("exportSvg()'s root tag changed shape: update card() in look.ts")
    const file = path.join(outDir, opts.name ?? `card-${++cards}.png`)
    await snap(framed, file)
    console.log(`card: ${file}`)
    return file
  }

  let refs = 0
  /** an official render in reference/, stretched onto the card box as the preview's picker does */
  const ref = async (image: string, opts: CardOptions = {}): Promise<string> => {
    const type = IMAGE_TYPES[path.extname(image).toLowerCase()]
    if (!type) throw new Error(`not an image type the reference picker lists: ${image}`)
    const data = fs.readFileSync(path.join(root, 'reference', image)).toString('base64')
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" ${frame(opts)}>` +
      `<image href="data:${type};base64,${data}" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="none"/></svg>`
    const file = path.join(outDir, opts.name ?? `ref-${++refs}.png`)
    await snap(svg, file)
    console.log(`ref: ${file}`)
    return file
  }

  const read = (file: string): string => fs.readFileSync(file, 'utf8')

  await page.goto(url)
  // the app shows .app-loading until startup ends in .app-shell or a failure
  await page.waitForSelector('.app-shell, .app-loading:has-text("Failed to start")')
  const failed = page.locator('.app-loading')
  if (await failed.count()) throw new Error(await failed.innerText())
  await new AsyncFunction('page', 'shot', 'card', 'ref', 'read', steps)(page, shot, card, ref, read)
} finally {
  console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors')
  await browser.close()
  await server.close()
}
