# AGENTS.md — cookbook-web

Agent-facing notes for maintaining this repo. Human docs live in `README.md`.

- **Quarto version:** ≥ 1.9.37 (tested with 1.9.38)
- **Node requirement:** ≥ 18 (build time only)
- **R requirement:** ≥ 4.x with the `babelquarto` package (site renderer)

## Architecture

```
site/sources/**/*.gram (FR) + site/sources/fr/*.gram (EN)
site/.gram/ingredients.yaml (ingredient DB)
        └──> build.mjs ──> site/cookbook/<slug>.qmd (FR) + <slug>.en.qmd (EN)
                          + recipes-index-fr.json / recipes-index-en.json
                └──> babelquarto render ──> site/_site/ (FR root, EN under en/)
        client.js ──esbuild──> site/recipe-app.js  (browse table, import, EN chrome)
```

Recipe pages embed `{{< gram-interactive src=... >}}`; the vendored gram
extension (`site/_extensions/gram/`, synced from the gram-quarto repo)
compiles all scales at render time and serves the interactive app
(scale switcher, cook mode) from `gram-app.js`.

The site is multilingual via **babelquarto** (R package): `mainlanguage: fr`
(French renders at the site root), `languages: [en]` (pages `*.en.qmd`,
output under `en/`). Language switching is babelquarto's navbar button.
Note: Quarto 1.9.x language profiles append navbar lists instead of replacing
them, so `_quarto-en.yml` navbar overrides are NOT used — EN-page chrome labels
("Browse", "Import", footer) are swapped client-side in `client.js` instead.

### Build pipeline

`npm run build` runs four stages:

1. **`build.mjs`** — Compiles each recipe once via `@gram-lang/parser` +
   `kitchen` + `analyzer` (no `@gram-lang/cli` — its AI/React dependency tree
   is dead weight), writes per-recipe page pairs
   `site/cookbook/<slug>.qmd` (FR) and `<slug>.en.qmd` (EN), and the two
   per-language index JSONs `recipes-index-fr.json` / `recipes-index-en.json`.
   Ingredient DB loaded from `site/.gram/ingredients.yaml`. Adds a
   "translation welcome" callout to single-language recipes.
2. **`esbuild`** — Bundles `client.js` → `site/recipe-app.js` (IIFE format).
   Powers the browse filter table (with thumbnails), the Import page, and
   EN-page chrome labels. Scale switching and cook mode come from the gram
   extension's `gram-app.js`, injected automatically on pages with recipes.
3. **`Rscript babelquarto::render_website(project_path="site")`** — Renders
   the `site/` Quarto project → `site/_site/` (FR at root, EN under `en/`;
   the gram extension compiles recipes here, cached in
   `site/.quarto-gram-cache/`).
4. **`self-check.mjs --site`** — asserts no literal `{{LANGSWITCH}}` or
   `undefined.html` in built pages, checks index JSON pairing, warns (soft)
   about single-language recipes.

### Gram pipeline

Uses `@gram-lang/parser` → `@gram-lang/kitchen` → `@gram-lang/analyzer`
(mass normalization, yields, nutrition). Recipe HTML compilation lives in the
vendored gram extension (bundled `gram-compile.cjs`). The `gram check
"site/sources/**/*.gram"` command validates all sources.

### Ingredient DB

`site/.gram/ingredients.yaml` holds physical + nutritional data (densities,
yields, French/English names). The extension finds it by walking up from its
own directory. When adding an ingredient, include both EN and FR
names/aliases.

## Key Directories

| Path | Description |
| ------ | ------------- |
| `site/sources/` | French recipe sources (`*.gram`) + `bases/` (reusable modules) |
| `site/sources/fr/` | English recipe sources (`*.gram`) — yes, `fr` holds EN translations |
| `site/sources/_submissions/` | Community recipes from GitHub issues (PRs add files here) |
| `site/.gram/ingredients.yaml` | Ingredient DB (densities, nutrition, EN+FR names) |
| `site/.gram/config.yaml` | Gram configuration |
| `build.mjs` | Main build: recipe metadata → per-recipe page pairs + index JSONs |
| `import-parser.mjs` | Recipe text / schema.org JSON-LD → `.gram` draft (unit conversion to g/ml) |
| `client.js` | Browse table + Import page + EN chrome (bundled → `site/recipe-app.js`) |
| `site/` | Quarto website project (babelquarto, main language FR) |
| `site/_quarto.yml` | Quarto + babelquarto config (filters: `gram`, navbar) |
| `site/_extensions/gram/` | Vendored gram-quarto extension (synced from gram-quarto repo) |
| `site/_site/` | Quarto rendered output (generated, gitignored) |
| `site/css/` | `gantt.css` (vendored), `app.css` (site chrome; recipe styles in the extension) |
| `site/recipe-app.js` | Bundled client JS (generated) |
| `site/images/` | Recipe photos (`image:` front-matter in `.gram` points here) |
| `site/cookbook/` | Generated recipe page pairs (FR + `.en.qmd`) |
| `site/.quarto-gram-cache/` | Gram compilation cache (gitignored) |

## Development Commands

```bash
npm install
npm run build     # gram pipeline + esbuild + babelquarto render + self-check
npm run serve     # python3 -m http.server 8801 -d site/_site
npm run check     # gram check "site/sources/**/*.gram"
npm test          # node self-check.mjs
```

### Adding a recipe

Write `site/sources/<slug>.gram` (VS Code: "Gram - Recipe Language"
extension), then:

```bash
npx gram check "site/sources/**/*.gram"
npm run build
```

### Translating an external recipe

1. **AI** — `npx gram import <url-or-file> --pick-model` (needs AI provider key)
2. **Static** — Import tab on website: paste URL/raw text → extracts schema.org
   JSON-LD → falls back to plain-text → converts units → emits downloadable
   `.gram` draft. Untagged items (`# review:` comment in draft) → review, then
   save under `site/sources/`, extend `site/.gram/ingredients.yaml` if needed,
   then `npx gram check`.

## Code conventions

- **JavaScript** (Node ≥ 18, CommonJS — `"type": "commonjs"`)
- **esbuild** for bundling (no webpack/rollup)
- No linter configured — style consistent with `@gram-lang/*` ecosystem
- `build.mjs` calls `@gram-lang/parser|kitchen|analyzer` directly; do not
  re-introduce `@gram-lang/cli` (heavy AI/React dependency tree)

## Git

- `site/_site/`, `site/recipe-app.js`, `site/.quarto-gram-cache/`,
  `node_modules/` are gitignored
- `.pi-lens.json` ignores `site/_site/`, `site/site_libs/`, `site/recipe-app.js`,
  `node_modules/`, `dist/`
