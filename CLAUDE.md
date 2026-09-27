# tm-cardgen

Browser app for custom Terraforming Mars cards: one YAML spec per card, a live preview, PNG and PDF export. `README.md` has the user-facing picture.

## Checks

`make check` runs what CI runs: typecheck, lint, format check, tests. Run it before calling a change done.

## Layout

- `src/core` is the engine: spec parsing and validation, layout, SVG rendering. It stays DOM-free; `tsconfig.core.json` enforces that in `make typecheck`.
- `src/app` is the React app around it: the CodeMirror editor, card list, IndexedDB storage, export.
- Tests run in node; a test that mounts the editor says `@vitest-environment jsdom` at its top.

## Goldens

`tests/golden` snapshots every sample card's layout JSON and SVG, so anything that moves on a card changes them. Update with `make test ARGS=-u`, and look at the rendered card before accepting the new snapshot; the SVG diff alone doesn't show whether it looks right.

## Assets

`public/assets/` is vendored. `public/assets/README.md` records where every file came from, its license, and each change made to it; keep it current when adding or editing an asset.

## Official cards

- `reference/` may hold official card renders to compare against, following the conventions in `reference/README.md`. Only that README is tracked. Never commit official card images.
- Since the files are untracked, don't refer to them in the code or commit messages, unless it's just by card name (e.g., "Pets").

## Commits

Conventional Commits with a scope and a plain-English summary, e.g. `fix(layout): warn about a row's width only past the body box`.
