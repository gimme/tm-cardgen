# tm-cardgen

Make custom [Terraforming Mars](https://boardgamegeek.com/boardgame/167791/terraforming-mars) fan cards in the browser: write a card as a short YAML spec, watch the live preview, export PNGs or a print-ready PDF sheet.

Use it at https://gimme.github.io/tm-cardgen/. It starts with a few sample cards to edit, and the editor completes and checks the spec as you type. Everything is stored in your browser; export a project zip to back it up.

A card looks like this:

```yaml
name: Jovian Research Ring
cost: 25
tags: [jovian, space, science]
requirement: "{science-tag science-tag}"
body:
  - "[{titanium}] {card card}"
  - "(Requires 2 science tags. Increase your titanium production 1 step and draw 2 cards.)"
vp: "1 {/ jovian-tag}"
flavor: Four billion years of field notes, bound in ore
number: "005"
art: double-the-rubble.png
artist: NASA
```

## Run locally

```sh
make dev
```

Needs Node. `make` alone lists the other targets.

## Licenses

- Code: GPL-3.0-or-later (see `LICENSE`).
- Icons in `public/assets/`: GPLv3, vendored from [SliceOfBread/tm_cardmaker](https://github.com/SliceOfBread/tm_cardmaker); see `public/assets/README.md` for provenance.
- `public/assets/fonts/Prototype.ttf` is not GPL: freeware for personal use by Justin Callaghan, redistributed with its required `Prototype.txt`. TeX Gyre Pagella is under the GUST Font License. Open Sans is under the SIL Open Font License 1.1.
- Sample art: see `public/samples/art/SOURCES.md`.

Terraforming Mars is a trademark of FryxGames. This is unofficial fan content for personal use.
