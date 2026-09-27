---
name: look
description: Look at the app or a rendered card in headless Chromium, to check a UI or rendering change by eye, or to compare a card with its official render in reference/.
---

# Look

`scripts/look.ts` starts the dev server, opens the app in headless Chromium on a fresh profile, runs the steps it reads on stdin, and prints each image's path and the page's errors. It needs a browser, once per machine: `npx playwright install --only-shell chromium`.

```bash
npx tsx scripts/look.ts <out-dir> <<'EOF'
await page.locator('.card-name', { hasText: 'Meteor Swarm' }).click()
await shot('.preview-pane', 'preview.png')
await card(read('src/app/samples/meteor-swarm.yaml'), { region: { x: 40, y: 60, w: 23, h: 28 } })
EOF
```

The steps are the body of an async function with:

- `page`: Playwright's page, 1400 × 900 at device scale 2.
- `shot(selector?, name?)`: the page, or the first element matching `selector`.
- `card(yaml, { region?, scale?, name? })`: the spec, rendered from the SVG that the PNG export draws at 300 or 600 dpi, but at any scale. `region` is `{ x, y, w, h }` in mm from the card's top-left corner (the card is 63 × 88). `scale` is px per mm; by default the long side comes out at 1000 px.
- `ref(file, { region?, scale?, name? })`: an official render from `reference/`, stretched onto the card box as the preview's reference picker draws it. With the same `region` and `scale`, it comes out pixel for pixel over the same mm as `card()`, so the two compare side by side.
- `read(path)`: a file's text.

Without an out-dir, images go to a fresh temp dir. Names default to `shot-N.png`, `card-N.png` and `ref-N.png`.
