# Asset provenance

Icons and fonts vendored from the community card maker **tm_cardmaker** by
SliceOfBread — https://github.com/SliceOfBread/tm_cardmaker, commit
`7ac77f59b4ea013766d877f0ac685abc0b25baa3` — licensed GPLv3 (see `LICENSE`
in this directory). The directory layout mirrors that repository; only the
files this app draws are carried over.

Fonts, as shipped by tm_cardmaker: `fonts/Prototype.ttf` for the card chrome
(title, cost, VP, card number, requirement text) and the four
`fonts/texgyrepagella-*.ttf` faces for rules, flavor and notes (GUST Font
License, `fonts/GUST-FONT-LICENSE.txt`). Prototype is not under the GPL: it is
freeware by Justin Callaghan, free for personal use, redistributable only
together with its readme, `fonts/Prototype.txt`.

Deviations from upstream:

- `fonts/OpenSans-SemiBold.ttf` — added: the directive text face (Open
  Sans, SIL Open Font License 1.1, `fonts/OpenSans-LICENSE.txt`).
- `tags/city.png`, `tiles/city.png` — RGB scaled ×0.82 (upstream is nearly
  white; printed cards are gray).
- `production.png` — production-box texture from the open-source
  Terraforming Mars project (github.com/terraforming-mars/terraforming-mars).
- `resources/TR.png` — five transparent top rows cropped off.
- `globalparameters/oxygen.png` — transparent margin cropped off; the disc
  fills the box.
- `resources/fighter.png` — cropped to the cube, soft shadow and all.
- `tags/multi.png` — upstream's `tags/multitag.png`, renamed, with the black
  ring the other tags carry drawn onto it.

Terraforming Mars is a trademark of FryxGames; this is unofficial fan
content for personal use.
