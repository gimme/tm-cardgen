// The README's sample card is one of the shipped samples, minus the modeline.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

it('README sample card matches the shipped jovian-research-ring.yaml', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
  const block = /```yaml\n([\s\S]*?)```/.exec(readme)?.[1]
  expect(block).toBeDefined()
  const sample = fs.readFileSync(
    path.join(ROOT, 'src/app/samples/jovian-research-ring.yaml'),
    'utf8',
  )
  const [modeline, ...rest] = sample.split('\n')
  expect(modeline).toMatch(/^# yaml-language-server:/)
  expect(rest.join('\n')).toBe(block)
})
