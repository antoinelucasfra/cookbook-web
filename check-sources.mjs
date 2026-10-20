// check-sources.mjs — parse + compile .gram sources without writing anything.
// Usage: node check-sources.mjs [file ...]   (default: every file under site/sources)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(dir, e.name))
      : e.name.endsWith(".gram")
        ? [join(dir, e.name)]
        : [],
  );
}

const files = process.argv.slice(2);
const targets = files.length ? files : walk("site/sources");
let bad = 0;
for (const file of targets) {
  try {
    compile(getAST(readFileSync(file, "utf8")));
  } catch (e) {
    console.error(`FAIL ${file}: ${e.message.split("\n")[0]}`);
    bad++;
  }
}
if (bad) {
  console.error(`${bad} of ${targets.length} source(s) failed`);
  process.exitCode = 1;
} else {
  console.log(`${targets.length} source(s) OK`);
}
