# Official card references

Renders of official Terraforming Mars cards, to compare the app's output against. The images are not part of the repo: they are FryxGames' cards with licensed artwork, and this repo is public and GPL. Only this README is tracked; everything else here is gitignored, so fill the folder yourself.

With the dev server running, the preview's reference picker lists the image files at this folder's top level (`.png`, `.jpg`, `.jpeg`, `.webp`) and draws the chosen one in the card's place. Agents working on the renderer can compare against the same files.

## Conventions

- Crop so the image's edges are the card's cut line (63 × 88 mm). The picker stretches the file onto the card box without keeping its aspect ratio, so that crop is its only alignment; a looser one shifts and scales everything.
- Best is a 600 dpi render, 1489 × 2079 px. Lower-resolution scans and web images work for placement and layout, but are too soft to measure edge profiles from.
