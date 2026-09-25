import asteroid from './asteroid-mining-syndicate.yaml?raw'
import ridgeline from './ridgeline-greenhouses.yaml?raw'
import meteor from './meteor-swarm.yaml?raw'
import skimmer from './orbital-water-skimmer.yaml?raw'
import dust from './dust-filters.yaml?raw'
import jovian from './jovian-research-ring.yaml?raw'
import terraced from './terraced-reservoirs.yaml?raw'
import raiders from './hired-raiders.yaml?raw'

interface SampleCard {
  slug: string
  name: string
  text: string
}

export const SAMPLE_CARDS: SampleCard[] = [
  { slug: 'asteroid-mining-syndicate', name: 'ASTEROID MINING SYNDICATE', text: asteroid },
  { slug: 'ridgeline-greenhouses', name: 'Ridgeline Greenhouses', text: ridgeline },
  { slug: 'meteor-swarm', name: 'Meteor Swarm', text: meteor },
  { slug: 'orbital-water-skimmer', name: 'Orbital Water Skimmer', text: skimmer },
  { slug: 'dust-filters', name: 'Dust Filters', text: dust },
  { slug: 'jovian-research-ring', name: 'Jovian Research Ring', text: jovian },
  { slug: 'terraced-reservoirs', name: 'Terraced Reservoirs', text: terraced },
  { slug: 'hired-raiders', name: 'Hired Raiders', text: raiders },
]

/** art files the samples reference, fetched into the art store at seed time */
export const SAMPLE_ART_FILES = ['double-the-rubble.png']

/** template for the New Card button */
export const NEW_CARD_TEMPLATE = `# yaml-language-server: $schema=https://gimme.github.io/tm-cardgen/card.schema.json
name: New Card
cost: 10
tags: [building]
body:
  - "{3mc}"
  - "(Gain 3 MC.)"
`
