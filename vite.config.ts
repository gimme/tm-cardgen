/// <reference types="vitest/config" />
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
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

// On GitHub Pages the app is served from /<repo>/; CI sets BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), referenceListing()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
