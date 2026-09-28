/// <reference types="vitest/config" />
import { copyFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server only: GET <base>reference/index.json lists the image files in
// the project-root reference/ folder (official card renders kept locally,
// gitignored) for the preview pane's comparison picker. The folder never
// enters a build.
function referenceListing(): Plugin {
  return {
    name: 'reference-listing',
    apply: 'serve',
    configureServer(server) {
      const dir = join(server.config.root, 'reference')
      server.middlewares.use(`${server.config.base}reference/index.json`, (_req, res) => {
        let files: string[] = []
        try {
          files = readdirSync(dir)
            .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
            .sort()
        } catch {
          // no reference/ folder: an empty picker
        }
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(files))
      })
    },
  }
}

// Build only: the app again as 404.html, which GitHub Pages serves for an
// address it has no file for. A reload or a link at a card's page
// (card/<slug>) then starts the app, and the router shows that card.
function pagesFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'pages-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
    },
  }
}

// On GitHub Pages the app is served from /<repo>/; CI sets BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), referenceListing(), pagesFallback()],
  test: {
    // core and most of the app test in plain node; a file that mounts the
    // editor says `@vitest-environment jsdom` at its top
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
})
