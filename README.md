# Cookbook

Recipe site powered by the [Gram DSL](https://gram-lang.org) + Quarto.

## Layout

- `sources/**/*.gram` — source of truth (one file per recipe, `sources/bases/` for reusable modules)
- `.gram/ingredients.yaml` — ingredient DB (densities, yields, nutrition)
- `build.mjs` — compiles each recipe once → metadata; writes per-recipe Quarto pages
  (`site/cookbook/*.qmd`) embedding `{{< gram-interactive >}}`, and the two browse
  indexes `site/recipes-index.json` / `-fr.json`
- `site/_extensions/gram/` — vendored [gram-quarto](https://github.com/antoinelucasfra/gram-quarto)
  extension; compiles recipes × scales at render time and ships the interactive app
  (scale switcher, cook mode) — sync from the gram-quarto repo when it changes
- `import-parser.mjs` — recipe text / schema.org JSON-LD → Gram draft (unit conversion to g/ml); self-check via `npm test`
- `client.js` → `site/recipe-app.js` — the Browse page filter table and the Import page
  (URL / raw text → `.gram` draft → download or "Publish" to GitHub)
- `site/` — Quarto website (output: `site/_site/`)

## Commands

    npm install
    npm run build     # gram pipeline + esbuild + quarto render
    npm run serve     # http://127.0.0.1:8801

## Adding a recipe

Two ways:

1. **From the site** — Import tab, paste text or a URL, review the draft, then
   "Publish to the cookbook": it opens a prefilled GitHub issue. Adding the
   `recipe-submission` label to that issue makes CI open a PR with the `.gram`
   file in `sources/_submissions/`. Review, move it to `sources/` (EN) or
   `sources/fr/` (FR), extend `.gram/ingredients.yaml` with missing
   ingredients, merge.
2. **Locally** — write `sources/<slug>.gram` (VS Code: "Gram - Recipe Language"
   extension), then `npx gram check "sources/**/*.gram"` and `npm run build`.

Optional recipe photo: set `image: /images/<slug>.jpg` in the `.gram` front-matter
and drop the file in `site/images/`. It shows on the home-page card, and Quarto
uses it for Open Graph tags. Recipes without a photo render text-only cards.

## Translating an external recipe into Gram

Two paths:

1. **With AI** — `npx gram import <url-or-file> --pick-model` converts a web page,
   JSON-LD file or YouTube video into `.gram`. Needs an AI provider key
   (google/openai/anthropic/ollama) configured for the gram CLI.
2. **Without AI** — the **Import** tab on the website: paste raw recipe text or a
   URL; it extracts schema.org Recipe JSON-LD when present, falls back to plain-text
   parsing, converts cups/tbsp/tsp/oz/lb to ml/g and emits a downloadable `.gram`
   draft.

The static pass tags what it could not handle confidently (missing title,
ingredients or steps; quantities missing; unfamiliar units) both in the UI and as
a `# review:` comment in the draft — those flags mean an AI translation pass is
recommended. Review the draft, save under `sources/`, extend
`.gram/ingredients.yaml` with any missing ingredients, then `npx gram check`.

## Bilingual site (EN / FR)

The site is fully bilingual. English lives in `sources/` and renders to `site/cookbook/`;
French recipes live in `sources/fr/*.gram` and render (with the gram renderer's
`lang: fr` output — French UI labels, tooltips, timings) to `site/fr/cookbook/`.

- Each page links to its counterpart ("Version française" / "English version").
- The Browse table reads `recipes-index.json` / `recipes-index-fr.json` depending on
  the page language (`<html lang>`).
- Ingredient display names: French names come from `name_fr` + aliases in
  `.gram/ingredients.yaml`. When adding an ingredient, include both English and
  French names/aliases.
