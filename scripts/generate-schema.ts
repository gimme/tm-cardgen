// Generates schema/card.schema.json from the validator's field table, for
// external editors via the yaml-language-server modeline. Structure and enums
// only; the row language stays app-validated. Run: npm run schema
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ART_FIELDS,
  KNOWN_TAGS,
  TOP_LEVEL_FIELDS,
  type ArtField,
  type TopLevelField,
} from '../src/core/index.ts'

const rowString = { type: 'string' }
const mm = { type: 'number' }

const doc = (key: TopLevelField) => TOP_LEVEL_FIELDS[key].doc

const rows = (key: TopLevelField) => ({
  type: ['array', 'string', 'null'],
  items: rowString,
  description: doc(key),
})

const artDoc = (key: ArtField) => ART_FIELDS[key].doc

const artProperties: Record<ArtField, object> = {
  file: { type: 'string', minLength: 1, description: artDoc('file') },
  zoom: { type: 'number', minimum: 1, description: artDoc('zoom') },
  offset: { type: 'array', items: mm, minItems: 2, maxItems: 2, description: artDoc('offset') },
}

// Record<TopLevelField>: a field added to the validator fails to compile here
const properties: Record<TopLevelField, object> = {
  name: { type: 'string', minLength: 1, description: doc('name') },
  cost: {
    oneOf: [{ type: 'integer', minimum: 0 }, { enum: ['X'] }],
    description: doc('cost'),
  },
  tags: { type: 'array', items: { enum: [...KNOWN_TAGS] }, description: doc('tags') },
  requirement: { ...rowString, description: doc('requirement') },
  active: rows('active'),
  body: rows('body'),
  vp: {
    oneOf: [{ type: 'integer' }, { type: 'string' }],
    description: doc('vp'),
  },
  flavor: { type: 'string', description: doc('flavor') },
  number: {
    oneOf: [{ type: 'string' }, { type: 'integer' }],
    description: doc('number'),
  },
  art: {
    oneOf: [
      { type: 'string', minLength: 1 },
      {
        type: 'object',
        required: ['file'],
        properties: artProperties,
        additionalProperties: false,
      },
    ],
    description: doc('art'),
  },
  artist: { type: 'string', description: doc('artist') },
  seed: { type: 'integer', description: doc('seed') },
}

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://gimme.github.io/tm-cardgen/card.schema.json',
  title: 'tm-cardgen card',
  description:
    'A custom Terraforming Mars card. Row strings (body, active, requirement, vp) are validated by the app, not this schema.',
  type: 'object',
  required: ['name'],
  properties,
  additionalProperties: false,
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
const json = JSON.stringify(schema, null, 2) + '\n'
fs.mkdirSync(path.join(HERE, '../schema'), { recursive: true })
fs.writeFileSync(path.join(HERE, '../schema/card.schema.json'), json)
// published on Pages next to the app
fs.writeFileSync(path.join(HERE, '../public/card.schema.json'), json)
console.log('wrote schema/card.schema.json and public/card.schema.json')
