// Checks that every asset link in dist/index.html carries the deploy base path
// and exists on disk, the failure that only shows when Pages serves from
// /<repo>/. Run: make verify-pages
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE_PATH ?? '/'
const dist = 'dist'

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])

let bad = 0
for (const ref of refs) {
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) continue

  if (!ref.startsWith(base)) {
    console.error(`not base-prefixed (${base}): ${ref}`)
    bad++
    continue
  }

  const file = path.join(dist, ref.slice(base.length).replace(/[?#].*$/, ''))
  if (!fs.existsSync(file)) {
    console.error(`missing: ${ref}`)
    bad++
  }
}

if (bad > 0) {
  console.error(`\n${bad} bad link(s) in ${dist}/index.html`)
  process.exit(1)
}
console.log(`${refs.length} links in ${dist}/index.html resolve under ${base}`)
