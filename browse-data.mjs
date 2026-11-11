// browse-data.mjs — pure browse-table logic (no DOM), checked by self-check.mjs
export function fmtTime(min) {
  if (min == null) return "";
  const t = Math.round(min);
  const h = Math.floor(t / 60), m = t % 60;
  return h ? `${h} h ${m ? m + " min" : ""}`.trim() : `${m} min`;
}

export function filterRecipes(recipes, q, cat) {
  const needle = q.trim().toLowerCase();
  return recipes.filter(
    (r) =>
      (!cat || r.category === cat) &&
      (!needle ||
        `${r.title} ${r.category} ${r.source}`.toLowerCase().includes(needle)),
  );
}

// recipe photos are site-root relative (/images/x.jpg); en/ pages sit one level down
export function imageSrc(image, fr) {
  return /^https?:\/\//.test(image)
    ? image
    : (fr ? "" : "../") + image.replace(/^\//, "");
}

// portions are stored as strings ("10"), so they must be compared as numbers
export function sortRecipes(rows, key, asc) {
  const cmp = (a, b) => {
    const va = a[key], vb = b[key];
    if (key === "portions") return (Number(va) || 0) - (Number(vb) || 0);
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    return String(va).localeCompare(String(vb));
  };
  return [...rows].sort((a, b) => (asc ? cmp(a, b) : -cmp(a, b)));
}
