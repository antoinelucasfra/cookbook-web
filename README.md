# Cookbook

Recipe site powered by the [Gram DSL](https://gram-lang.org) + Quarto.

## Layout

- `site/sources/*.gram` — English originals; `site/sources/fr/*.gram` — French
  (main language, rendered at the site root). Pairing key is the basename;
  `site/sources/bases/` holds reusable modules
- `site/.gram/ingredients.yaml` — ingredient DB (densities, yields, nutrition)
- `build.mjs` — compiles each recipe once → metadata; writes per-recipe Quarto
  page pairs (`site/cookbook/<slug>.qmd` FR + `<slug>.en.qmd` EN) embedding
  `{{< gram-interactive >}}`, and the two browse indexes
  `site/recipes-index-fr.json` / `-en.json`
- `site/_extensions/gram/` — vendored [gram-quarto](https://github.com/antoinelucasfra/gram-quarto)
  extension; compiles recipes × scales at render time and ships the interactive
  app (scale switcher, cook mode) — sync from the gram-quarto repo when it changes
- `import-parser.mjs` — recipe text / schema.org JSON-LD → Gram draft (unit
  conversion to g/ml); self-check via `npm test`
- `client.js` → `site/recipe-app.js` — the Browse page filter table (with
  thumbnails), the Import page (URL / raw text → `.gram` draft → download or
  "Publish" to GitHub), and EN-page chrome labels
- `site/` — Quarto website (multilingual, rendered by babelquarto; output
  `site/_site/`, French at the root, English under `en/`)

## Commands

    npm install
    npm run build     # gram pipeline + esbuild + babelquarto render + site self-check
    npm run check     # parse + compile every .gram source
    npm run serve     # http://127.0.0.1:8801

## Adding a recipe

Two ways:

1. **From the site** — Import tab, paste text or a URL, review the draft, then
   "Publish to the cookbook": it opens a prefilled GitHub issue. Adding the
   `recipe-submission` label to that issue makes CI open a PR with the `.gram`
   file in `site/sources/_submissions/`. Review, move it to `site/sources/`
   (EN) or `site/sources/fr/` (FR), extend `site/.gram/ingredients.yaml` with
   missing ingredients, merge.
2. **Locally** — write `site/sources/<slug>.gram` (VS Code: "Gram - Recipe
   Language" extension), then `npm run check` and `npm run build`.

Optional recipe photo: set `image: /images/<slug>.jpg` in the `.gram`
front-matter and drop the file in `site/images/`. It shows as a thumbnail in
the Browse table and Quarto uses it for Open Graph tags. Recipes without a
photo get a category-tinted initial badge instead.

## Translating an external recipe into Gram

Two paths:

1. **With AI** — `npx gram import <url-or-file> --pick-model` converts a web
   page, JSON-LD file or YouTube video into `.gram`. Needs an AI provider key
   (google/openai/anthropic/ollama) configured for the gram CLI.
2. **Without AI** — the **Import** tab on the website: paste raw recipe text or
   a URL; it extracts schema.org Recipe JSON-LD when present, falls back to
   plain-text parsing, converts cups/tbsp/tsp/oz/lb to ml/g and emits a
   downloadable `.gram` draft.

The static pass tags what it could not handle confidently (missing title,
ingredients or steps; quantities missing; unfamiliar units) both in the UI and
as a `# review:` comment in the draft — those flags mean an AI translation pass
is recommended. Review the draft, save under `site/sources/`, extend
`site/.gram/ingredients.yaml` with any missing ingredients, then
`npm run check`.

## Bilingual site (FR / EN)

The site is multilingual thanks to
[babelquarto](https://docs.ropensci.org/babelquarto/) (R package, part of the
Quarto ecosystem): French is the main language and renders at the site root,
English pages are the `*.en.qmd` files rendered under `en/`. Sources pair 1:1
by basename: `site/sources/<slug>.gram` (EN) ↔ `site/sources/fr/<slug>.gram`
(FR).

- babelquarto injects the language switcher in the navbar; `build.mjs` adds a
  "translation welcome" callout to single-language recipes and the site
  self-check reports EN↔FR parity (warnings only — publishing a recipe in one
  language is allowed, translating it is warmly encouraged).
- The Browse table reads `recipes-index-fr.json` / `recipes-index-en.json`
  depending on the page language (`<html lang>`).
- Ingredient display names: French names come from `name_fr` + aliases in
  `site/.gram/ingredients.yaml`. When adding an ingredient, include both
  English and French names/aliases.
- Note: Quarto 1.9.x language profiles append navbar lists instead of
  replacing them, so per-language navbar labels can't live in
  `_quarto-en.yml`; EN-page chrome labels are swapped client-side in
  `client.js` instead.
