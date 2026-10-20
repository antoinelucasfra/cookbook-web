// client.js — browse filter table + import page
// Scale switching and cook mode now live in the gram extension
// (_extensions/gram/resources/gram-app.js, injected on recipe pages).
// Bundled with esbuild (IIFE) → site/recipe-app.js
import {
  parseRecipeText,
  extractJsonLdRecipe,
  jsonLdToDraft,
  draftToGram,
  aiNeededTags,
  slugify,
} from "./import-parser.mjs";

// --- Browse page: filterable recipe table ---
function fmtTime(min) {
  if (min == null) return "";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h ${m ? m + " min" : ""}`.trim() : `${m} min`;
}

async function initBrowse() {
  const table = document.querySelector("#browse-table");
  if (!table) return;
  let recipes;
  const fr = document.documentElement.lang === "fr";
  try {
    // fr (main language) renders at site root; en renders under /en/
    recipes = await (await fetch(fr ? "recipes-index-fr.json" : "../recipes-index-en.json")).json();
  } catch {
    table.textContent = fr
      ? "Échec du chargement de l’index des recettes."
      : "Failed to load recipe index.";
    return;
  }
  const tbody = table.querySelector("tbody");
  const search = document.querySelector("#browse-search");
  const catSel = document.querySelector("#browse-category");
  const count = document.querySelector("#browse-count");
  const cats = [...new Set(recipes.map((r) => r.category))].sort();
  for (const c of cats) catSel.add(new Option(c, c));
  let sortKey = "title", sortAsc = true;

  function rows() {
    const q = search.value.trim().toLowerCase();
    const cat = catSel.value;
    return recipes
      .filter(
        (r) =>
          (!cat || r.category === cat) &&
          (!q || `${r.title} ${r.category} ${r.source}`.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const va = a[sortKey], vb = b[sortKey];
        const c = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
        return sortAsc ? c : -c;
      });
  }

  function render() {
    const rs = rows();
    tbody.replaceChildren(
      ...rs.map((r) => {
        const tr = document.createElement("tr");
        const td = (text) => {
          const c = document.createElement("td");
          c.textContent = text;
          return c;
        };
        const link = document.createElement("a");
        link.href = `cookbook/${r.slug}.html`;
        link.textContent = r.title;
        const titleTd = document.createElement("td");
        titleTd.className = "browse-title-cell";
        // thumbnail: real photo when site/images/<slug>.jpg exists, else a
        // category-tinted initial badge (photos are optional)
        const imgPrefix = fr ? "images/" : "../images/";
        if (r.image) {
          const img = document.createElement("img");
          img.src = r.image.startsWith("http") ? r.image : `${imgPrefix}${r.slug}.jpg`;
          img.alt = "";
          img.loading = "lazy";
          img.className = "browse-thumb";
          titleTd.append(img, link);
        } else {
          const badge = document.createElement("span");
          badge.className = "browse-thumb browse-thumb-fallback";
          badge.textContent = (r.title || "?")[0].toUpperCase();
          badge.dataset.cat = r.category;
          titleTd.append(badge, link);
        }
        tr.append(titleTd, td(r.category), td(fmtTime(r.time)), td(r.portions), td(r.source ?? ""));
        return tr;
      })
    );
    count.textContent = `${rs.length} / ${recipes.length} ${fr ? "recettes" : "recipes"}`;
  }

  table.querySelectorAll("th[data-sort]").forEach((th) =>
    th.addEventListener("click", () => {
      const k = th.dataset.sort;
      sortAsc = k === sortKey ? !sortAsc : true;
      sortKey = k;
      table
        .querySelectorAll("th[data-sort]")
        .forEach((t) => t.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(sortAsc ? "sort-asc" : "sort-desc");
      render();
    })
  );
  search.addEventListener("input", render);
  catSel.addEventListener("change", render);
  render();
}
initBrowse();

// --- Import page: URL / raw text → .gram draft ---
async function fetchPage(url) {
  // direct first (CORS-permitting sites), then a markdown-reading proxy
  // ponytail: single proxy fallback; add more here if r.jina.ai rate-limits
  const attempts = [url, `https://r.jina.ai/${url}`];
  let lastErr;
  for (const u of attempts) {
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("fetch failed");
}

const GITHUB_REPO = "antoinelucasfra/cookbook-web";
// URL length limits (browsers/GitHub) — beyond this, suggest download + manual issue
const ISSUE_URL_LIMIT = 6000;

function initImport() {
  const form = document.querySelector("#import-form");
  if (!form) return;
  const fr = document.documentElement.lang === "fr";
  const T = fr
    ? {
        needsReview: "⚠ À vérifier — traduction IA recommandée pour :",
        aiTip: "Essayez `npx gram import <url> --pick-model` pour une conversion assistée par IA.",
        parsed: (i, s) => `${i} ingrédients et ${s} étapes analysés.`,
        flagged: (n) => ` ${n} élément(s) marqué(s) à relire.`,
        clean: " Traduction statique qui semble complète.",
        enter: "Saisissez une URL de recette ou collez le texte de la recette.",
        urlPrefix: "L’URL doit commencer par http(s)://",
        fetching: "Récupération…",
        failed: (m) => `Échec de l’import : ${m}. Collez plutôt le texte de la recette.`,
        copied: "Copié dans le presse-papiers.",
        publish: "Publier sur le cookbook (GitHub)",
        publishing: "Ouvre une page GitHub…",
        tooLong: "Recette trop longue pour le formulaire GitHub : téléchargez le fichier .gram et joignez-le à une issue.",
        issueIntro: "Recette proposée via la page Import du site.",
      }
    : {
        needsReview: "⚠ Needs review — AI translation recommended for these:",
        aiTip: "Try `npx gram import <url> --pick-model` for AI-assisted conversion.",
        parsed: (i, s) => `Parsed ${i} ingredients and ${s} steps.`,
        flagged: (n) => ` ${n} item(s) flagged for review.`,
        clean: " Looks like a clean static translation.",
        enter: "Enter a recipe URL or paste the recipe text.",
        urlPrefix: "URL must start with http(s)://",
        fetching: "Fetching…",
        failed: (m) => `Import failed: ${m}. Paste the recipe text instead.`,
        copied: "Copied to clipboard.",
        publish: "Publish to the cookbook (GitHub)",
        publishing: "Opens a GitHub page…",
        tooLong: "Recipe too long for the GitHub form: download the .gram file and attach it to an issue.",
        issueIntro: "Recipe submitted through the site's Import page.",
      };
  const urlIn = document.querySelector("#import-url");
  const textEl = document.querySelector("#import-text");
  const status = document.querySelector("#import-status");
  const out = document.querySelector("#import-output");
  const preview = out?.querySelector("#import-preview");
  let gramText = "";

  function show(msg, isError = false) {
    status.textContent = msg;
    status.classList.toggle("error", isError);
  }

  function emit(draft, meta) {
    gramText = draftToGram(draft, meta);
    const tags = aiNeededTags(draft);
    if (preview) preview.value = gramText;
    const tagBox = document.querySelector("#import-tags");
    tagBox.replaceChildren();
    if (tags.length) {
      const p = document.createElement("p");
      p.className = "import-tags-title";
      p.textContent = T.needsReview;
      const ul = document.createElement("ul");
      for (const t of tags) {
        const li = document.createElement("li");
        li.textContent = t;
        ul.append(li);
      }
      const tip = document.createElement("p");
      tip.textContent = T.aiTip;
      tagBox.append(p, ul, tip);
    }
    tagBox.hidden = !tags.length;
    out.hidden = false;
    show(
      `${T.parsed(draft.ingredients.length, draft.steps.length)}${tags.length ? T.flagged(tags.length) : T.clean}`,
      tags.length > 0 && (!draft.ingredients.length || !draft.steps.length),
    );
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    out.hidden = true;
    const url = urlIn.value.trim();
    const raw = textEl.value.trim();
    try {
      if (raw && !url) {
        emit(parseRecipeText(raw), {});
        return;
      }
      if (!url) return show(T.enter, true);
      if (!/^https?:\/\//.test(url)) return show(T.urlPrefix, true);
      show(T.fetching);
      const body = await fetchPage(url);
      let recipe = null;
      try {
        recipe = extractJsonLdRecipe(body);
      } catch {
        /* plain-text body (e.g. r.jina.ai markdown) */
      }
      if (recipe) {
        const draft = jsonLdToDraft(recipe);
        if (!draft.title) draft.title = parseRecipeText("").title || url;
        emit(draft, { source: url, portions: draft.meta?.portions ?? "" });
      } else {
        emit(parseRecipeText(body, ""), { source: url });
      }
    } catch (err) {
      show(T.failed(err.message), true);
    }
  });

  // copy/download/publish use the (possibly hand-edited) preview content
  const currentText = () => preview?.value || gramText;

  document.querySelector("#import-copy")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(currentText());
    show(T.copied);
  });
  document.querySelector("#import-download")?.addEventListener("click", () => {
    const gram = currentText();
    const title = gram.match(/^title: (.+)$/m)?.[1] ?? "recipe";
    const slug = slugify(title);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([gram], { type: "text/plain" }));
    a.download = `${slug}.gram`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // publish: open a prefilled GitHub issue; CI turns labeled issues into PRs
  document.querySelector("#import-publish")?.addEventListener("click", () => {
    const gram = currentText();
    if (!gram) return;
    const title = gram.match(/^title: (.+)$/m)?.[1] ?? (fr ? "Recette" : "Recipe");
    const body = `${T.issueIntro}\n\n\`\`\`gram\n${gram}\n\`\`\`\n`;
    const issueUrl =
      `https://github.com/${GITHUB_REPO}/issues/new` +
      `?title=${encodeURIComponent("[recipe] " + title)}` +
      `&body=${encodeURIComponent(body)}`;
    if (issueUrl.length > ISSUE_URL_LIMIT) {
      show(T.tooLong, true);
      return;
    }
    show(T.publishing);
    window.open(issueUrl, "_blank", "noopener");
  });
}
initImport();

// --- site chrome: Quarto 1.9 language profiles append navbar lists instead of
// replacing them, so babelquarto can't carry per-language labels — translate
// the few fixed strings client-side on EN pages (labels are stable)
if (document.documentElement.lang !== "fr") {
  for (const a of document.querySelectorAll(".navbar-nav .nav-link, .navbar-nav .dropdown-item")) {
    if (a.textContent.trim() === "Parcourir") a.textContent = "Browse";
    if (a.textContent.trim() === "Importer") a.textContent = "Import";
  }
  for (const el of document.querySelectorAll(".page-footer, footer")) {
    if (el.textContent.includes("Cuisiné avec"))
      el.innerHTML = el.innerHTML.replaceAll("Cuisiné avec", "Cooked with");
  }
}
