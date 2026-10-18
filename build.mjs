// build.mjs — .gram sources → index JSON + per-recipe Quarto pages
// babelquarto layout: main language (fr) pages are <slug>.qmd, the further
// language (en) pages are <slug>.en.qmd, both in site/cookbook/. This script:
//   - compiles each recipe once to extract metadata (title, time, portions…)
//   - writes site/cookbook/<slug>.qmd (FR) and site/cookbook/<slug>.en.qmd (EN)
//   - writes recipes-index-fr.json / recipes-index-en.json for the browse table
//   - adds a callout to single-language recipes (missing counterpart)
// Language switching itself is babelquarto's job (navbar button).
// Usage: node build.mjs
import {
  readdirSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join, basename } from "node:path";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import yaml from "yaml";
const { load } = yaml;

const DB = (() => {
  const raw = yaml.parse(readFileSync("site/.gram/ingredients.yaml", "utf8"));
  return raw.ingredients ?? raw;
})();

function listGram(dir, excludeFr = false) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === "_submissions" || (excludeFr && e.name === "fr")
        ? [] // staged submissions are published after review; fr/ has its own pass
        : listGram(join(dir, e.name))
      : e.name.endsWith(".gram")
        ? [join(dir, e.name)]
        : [],
  ).map((f) => f.replace(/\\/g, "/"));
}

// compile one source and analyze against the ingredient DB (metadata + nutrition)
function buildRecipe(file, lang) {
  const ast = getAST(readFileSync(file, "utf8"));
  const compiled = compile(ast);
  const analyzed = analyze(compiled, DB, { lang });
  return (analyzed && analyzed.result) || compiled;
}

rmSync("site/cookbook", { recursive: true, force: true });
mkdirSync("site/cookbook", { recursive: true });

// src path used in the {{< gram-interactive >}} shortcode, relative to the
// Quarto project dir (site/)
const srcPath = (file) => `sources/${basename(file)}`;

// escape YAML double-quoted scalars
const q = (s) => String(s).replace(/[\\"]/g, "\\$&");

// slug = source basename — this is also the EN<->FR pairing key
function buildPass({ dir, lang, suffix = "" }) {
  const index = [];
  for (const file of listGram(dir, lang === "fr").filter((f) => !f.includes("bases/"))) {
    const base = buildRecipe(file, lang);
    const slug = basename(file, ".gram");
    const image = base.meta?.image;

    writeFileSync(
      `site/cookbook/${slug}${suffix}.qmd`,
      `---
title: "${q(base.title)}"
category: "${q(base.meta?.category ?? "Uncategorized")}"
total_time: "${q(base.metrics?.totalTime ?? 0)} min"
portions: "${q(base.meta?.portions ?? "")}"
${image ? `image: "${q(image)}"\n` : ""}---

{{< gram-interactive src="${srcPath(file)}" lang="${lang}" >}}
`,
    );

    index.push({
      slug,
      title: base.title,
      category: base.meta?.category ?? "Uncategorized",
      time: base.metrics?.totalTime ?? 0,
      portions: base.meta?.portions ?? "",
      source: base.meta?.source ?? "",
      image: image ?? "",
    });
    console.log(`✓ ${lang}/${slug} (${base.metrics?.totalTime ?? "?"} min)`);
  }
  return index;
}

const fr = buildPass({ dir: "site/sources", lang: "fr" });
const en = buildPass({ dir: "site/sources/fr", lang: "en", suffix: ".en" });

// single-language recipes get a "translation welcome" callout
const frSlugs = new Set(fr.map((r) => r.slug));
const enSlugs = new Set(en.map((r) => r.slug));
const CALLOUT = {
  fr: (slug) =>
    `::: {.callout-note appearance="simple"}\nCette recette n'existe qu'en anglais — une traduction est la bienvenue !\n:::\n\n`,
  en: (slug) =>
    `::: {.callout-note appearance="simple"}\nThis recipe is only available in French — a translation is warmly welcome!\n:::\n\n`,
};
for (const slug of frSlugs)
  if (!enSlugs.has(slug)) {
    const p = `site/cookbook/${slug}.qmd`;
    writeFileSync(p, CALLOUT.fr(slug) + readFileSync(p, "utf8"));
  }
for (const slug of enSlugs)
  if (!frSlugs.has(slug)) {
    const p = `site/cookbook/${slug}.en.qmd`;
    writeFileSync(p, CALLOUT.en(slug) + readFileSync(p, "utf8"));
  }

writeFileSync("site/recipes-index-fr.json", JSON.stringify(fr, null, 2));
writeFileSync("site/recipes-index-en.json", JSON.stringify(en, null, 2));

const missing = [...frSlugs].filter((s) => !enSlugs.has(s)).length +
  [...enSlugs].filter((s) => !frSlugs.has(s)).length;
if (missing)
  console.warn(
    `⚠ ${missing} recipe(s) lack an EN/FR counterpart — published single-language, translation warmly encouraged`,
  );
console.log(`\n${fr.length} FR + ${en.length} EN recipes → site/cookbook/`);
