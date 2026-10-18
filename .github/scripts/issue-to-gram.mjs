// issue-to-gram.mjs — extract a ```gram fenced block from a GitHub issue body
// and stage it as /tmp/submission.gram. Sets outputs.slug ("" when nothing
// usable found). Idempotent: same issue → same file content (overwrites).
// Env: ISSUE_BODY, ISSUE_NUMBER, ISSUE_AUTHOR
import { writeFileSync, mkdirSync, appendFileSync } from "node:fs";

const body = process.env.ISSUE_BODY ?? "";

// fenced block: ```gram ... ``` (first one wins; tolerate 4+ backticks nearby)
const m = body.match(/^```gram\r?\n([\s\S]*?)\r?\n```\s*$/m) ?? body.match(/```gram\r?\n([\s\S]*?)\n```/);
const gram = m?.[1]?.trim();

// also emit step outputs for the workflow (keep stdout logs for humans)
function emit(slug) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);
  console.log(`slug=${slug}`);
}

function fail(msg) {
  console.log(`::error::${msg}`);
  emit("");
  process.exit(0);
}

if (!gram) fail("no ```gram fenced block found in issue body");

// basic validation — fail loudly instead of opening a broken PR
if (!/^title:\s*\S/m.test(gram)) fail("draft has no `title:` line");
if (!/^[#@~]/m.test(gram)) fail("draft has no ingredients (@…{}), cookware (#…{}) or timers (~{})");
if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(gram)) fail("control characters in draft — not gram text?");
const open = (gram.match(/[{[]/g) || []).length;
const close = (gram.match(/[}\]]/g) || []).length;
if (open !== close) fail(`unbalanced braces/brackets (${open} open vs ${close} close)`);

// slug from title line, de-accented; fall back to issue number
const title = gram.match(/^title:\s*(.+)$/m)[1].trim();
const slug =
  title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `recipe-issue-${process.env.ISSUE_NUMBER}`;

// provenance comment at the end of the file
const header =
  `# submitted via issue #${process.env.ISSUE_NUMBER} by @${process.env.ISSUE_AUTHOR}\n`;
mkdirSync("/tmp", { recursive: true });
writeFileSync("/tmp/submission.gram", gram + "\n\n" + header);

emit(slug);
