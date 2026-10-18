// build.mjs — .gram sources → index JSON + per-recipe Quarto pages
// Page bodies use {{< gram-interactive >}} from the vendored gram extension,
// which compiles all scales at quarto render time. This script only:
//   - compiles each recipe once to extract metadata (title, time, portions…)
//   - writes site/cookbook/<slug>.qmd (EN) and site/fr/cookbook/<slug>.qmd (FR)
//   - writes recipes-index.json / recipes-index-fr.json for the browse table
// Usage: node build.mjs
import {
  readdirSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join, basename } from "node:path";
import { runPipeline } from "@gram-lang/cli";
import { load } from "js-yaml";

const DB = (() => {
  const raw = load(readFileSync(".gram/ingredients.yaml", "utf8"));
  return raw.ingredients ?? raw;
})();

function listGram(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === "_submissions"
        ? [] // staged submission PRs — published only after a reviewer moves them
        : listGram(join(dir, e.name))
      : e.name.endsWith(".gram")
        ? [join(dir, e.name)]
        : [],
  ).map((f) => f.replace(/\\/g, "/"));
}

rmSync("site/cookbook", { recursive: true, force: true });
rmSync("site/recipes-index.json", { force: true });
mkdirSync("site/cookbook", { recursive: true });
mkdirSync("site/fr/cookbook", { recursive: true });

// src path used in the {{< gram-interactive >}} shortcode, relative to the
// Quarto project dir (site/)
const srcPath = (file) => `../${file.replace(/\\/g, "/")}`;

// escape YAML double-quoted scalars
const q = (s) => String(s).replace(/[\\"]/g, "\\$&");

async function buildPass({ dir, cookbookDir, lang = "en", excludeFr = false }) {
  const index = [];
  for (const file of listGram(dir).filter(
    (f) => !f.includes("bases/") && (!excludeFr || !f.includes("/fr/")),
  )) {
    const { analyzed } = await runPipeline(file, { db: DB, lang });
    const base = analyzed.result;
    const slug = base.slug;
    const image = base.meta?.image;

    const langSwitch = "{{LANGSWITCH}}";
    writeFileSync(
      `${cookbookDir}/${slug}.qmd`,
      `---
title: "${q(base.title)}"
${lang === "fr" ? "lang: fr\n" : ""}category: "${q(base.meta?.category ?? "Uncategorized")}"
total_time: "${q(base.metrics?.totalTime ?? 0)} min"
portions: "${q(base.meta?.portions ?? "")}"
${image ? `image: "${q(image)}"\n` : ""}---

${langSwitch}\n
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

// same source basenames pair 1:1 across sources/ and sources/fr/
const slugByBase = (idx, files) =>
  Object.fromEntries(idx.map((r, i) => [files[i], r.slug]));

const enFiles = listGram("sources")
  .filter((f) => !f.includes("bases/") && !f.includes("/fr/"))
  .map((f) => basename(f, ".gram"));
const en = await buildPass({
  dir: "sources",
  cookbookDir: "site/cookbook",
  excludeFr: true,
});
const frFiles = listGram("sources/fr")
  .filter((f) => !f.includes("bases/"))
  .map((f) => basename(f, ".gram"));
const fr = await buildPass({
  dir: "sources/fr",
  cookbookDir: "site/fr/cookbook",
  lang: "fr",
});

// resolve {{LANGSWITCH}} placeholders using basename→slug maps
const enSlug = slugByBase(en, enFiles);
const frSlug = slugByBase(fr, frFiles);
for (const [base, s] of Object.entries(frSlug)) {
  const p = `site/fr/cookbook/${s}.qmd`;
  writeFileSync(
    p,
    readFileSync(p, "utf8").replace(
      "{{LANGSWITCH}}",
      `<nav class="lang-switch" aria-label="Language"><span class="lang-opt active" aria-current="true">FR</span>${enSlug[base] ? `<a class="lang-opt" href="../../cookbook/${enSlug[base]}.html" hreflang="en" lang="en">EN</a>` : ""}</nav>`,
    ),
  );
}
for (const [base, s] of Object.entries(enSlug)) {
  const p = `site/cookbook/${s}.qmd`;
  writeFileSync(
    p,
    readFileSync(p, "utf8").replace(
      "{{LANGSWITCH}}",
      `<nav class="lang-switch" aria-label="Language">${frSlug[base] ? `<a class="lang-opt" href="../fr/cookbook/${frSlug[base]}.html" hreflang="fr" lang="fr">FR</a>` : ""}<span class="lang-opt active" aria-current="true">EN</span></nav>`,
    ),
  );
}

writeFileSync("site/recipes-index.json", JSON.stringify(en, null, 2));
writeFileSync("site/recipes-index-fr.json", JSON.stringify(fr, null, 2));
console.log(`\n${en.length} EN + ${fr.length} FR recipes → site/`);
