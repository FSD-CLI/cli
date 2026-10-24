#!/usr/bin/env node
// docs/qa/2.6.1/evidence/scripts/check-links.mjs
//
// Checks that every relative Markdown link in docs/qa/2.6.1/*.md points at a file or folder that exists.
// Exit code 0 when all links resolve, 1 when some are broken. No dependencies.
//
//   node docs/qa/2.6.1/evidence/scripts/check-links.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const QA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const docs = fs.readdirSync(QA_DIR).filter((f) => f.endsWith(".md"));
let checked = 0;
const broken = [];

for (const doc of docs) {
  const text = fs.readFileSync(path.join(QA_DIR, doc), "utf8");
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split("#")[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // external link or anchor only
    checked++;
    if (!fs.existsSync(path.resolve(QA_DIR, decodeURIComponent(target)))) broken.push(`${doc}: ${m[1]}`);
  }
}

console.log(`Documents: ${docs.join(", ")}`);
console.log(`Relative links checked: ${checked}; broken: ${broken.length}`);
for (const b of broken) console.log(`  BROKEN ${b}`);
process.exit(broken.length ? 1 : 0);
