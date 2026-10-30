#!/usr/bin/env node
// pnpm kannada:review → docs/field/kannada-review.md (architect R10). Every Kannada line in the
// app beside its English, with an empty "fix" column, for a native speaker to read aloud and mark
// anything bookish. Regenerate after copy changes; fixes go back into lib/i18n/kn.ts by hand.
import { writeFileSync } from "node:fs";

const { kn } = await import("../lib/i18n/kn.ts");
const { en } = await import("../lib/i18n/en.ts");

const AREAS = {
  hero: "Landing",
  doors: "Landing",
  door: "Landing",
  how: "Landing",
  promise: "Landing",
  footer: "Landing",
  room: "Rooms",
  import: "Import a recording",
  review: "Reviewer",
  stage: "Progress",
  loader: "Progress",
  voice: "Voice player",
  badge: "Labels",
  error: "Errors",
  notfound: "Errors",
  offline: "Offline",
};
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const groups = new Map();
for (const key of Object.keys(kn)) {
  const area = AREAS[key.split(".")[0]] ?? "Other";
  if (!groups.has(area)) groups.set(area, []);
  groups.get(area).push(key);
}

let out = `# Kannada review · read every line aloud\n\nGenerated ${new Date().toISOString().slice(0, 10)} from \`lib/i18n\` (${Object.keys(kn).length} lines). All Kannada was drafted by Claude. Please read each line aloud as a headmaster would say it to a young colleague; write a better line in **Fix** for anything bookish, stiff or wrong. Prajwal copies fixes into \`lib/i18n/kn.ts\`.\n`;
for (const [area, keys] of groups) {
  out += `\n## ${area}\n\n| Key | ಕನ್ನಡ | English | Fix |\n|---|---|---|---|\n`;
  for (const k of keys) out += `| \`${k}\` | ${esc(kn[k])} | ${esc(en[k] ?? "")} |  |\n`;
}
writeFileSync("docs/field/kannada-review.md", out);
console.log(`  ✓ docs/field/kannada-review.md (${Object.keys(kn).length} lines)`);
