#!/usr/bin/env node
// Scans tracked and staged files for secrets and obvious personal data. Exit 1 on findings.
import { execSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";

const sh = (c) => { try { return execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
const files = [...new Set((sh("git ls-files") + "\n" + sh("git diff --cached --name-only")).split("\n").filter(Boolean))];

const rules = [
  [/sk-ant-[A-Za-z0-9_\-]{20,}/, "Anthropic key"],
  [/sb_secret_[A-Za-z0-9_\-]{16,}/, "Supabase secret key"],
  [/\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}/, "GitHub token"],
  [/eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}/, "JWT (maybe Supabase service role)"],
  [/^(ANTHROPIC_API_KEY|SARVAM_API_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|SUPABASE_ACCESS_TOKEN|VERCEL_TOKEN)[ \t]*=[ \t]*['"]?[^\s'"#]{8,}/m, "secret assignment"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  // A standalone number only: digits inside a longer token (a hex hash, an id) are not a phone.
  [/(?<![\dA-Za-z])(\+91[\-\s]?)?[6-9]\d{9}(?![\dA-Za-z])/, "Indian phone number (personal data?)"],
];
const skip = /(^|\/)(pnpm-lock\.yaml|node_modules\/|\.next\/|docs\/demos\/.*\.(png|jpg|webm))/;
const findings = [];
for (const f of files) {
  if (skip.test(f) || !existsSync(f) || statSync(f).isDirectory()) continue;
  if (/(^|\/)\.env($|\.(?!example$))/.test(f)) { findings.push(`${f}: env file is tracked`); continue; }
  if (statSync(f).size > 2_000_000) continue;
  const text = readFileSync(f, "utf8");
  if (text.includes("\u0000")) continue;
  for (const [re, label] of rules) {
    const m = text.match(re);
    if (m && !/allow-secret-scan/.test(text.slice(Math.max(0, m.index - 200), m.index + 200))) {
      const line = text.slice(0, m.index).split("\n").length;
      findings.push(`${f}:${line}: ${label}`);
    }
  }
}
if (findings.length) { console.error("Secret / personal data scan FAILED:\n  " + findings.join("\n  ")); process.exit(1); }
console.log(`Secret scan clean (${files.length} files).`);
