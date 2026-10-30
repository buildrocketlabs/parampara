#!/usr/bin/env node
// First load JS per route, gzipped (DESIGN §10: under 200 KB for the teacher app).
//
//   node scripts/measure-js.mjs            build in fixture mode (no keys), then measure
//   node scripts/measure-js.mjs --no-build measure the existing .next build
//   node scripts/measure-js.mjs --json     machine readable output
//
// What counts: the root main files every page loads (build-manifest rootMainFiles) plus every JS
// file the route's client reference manifest lists for its entries (root and nested layouts,
// error, loading and not-found boundaries, and the page). That is everything the browser fetches
// before the page can hydrate. Chunks loaded later through next/dynamic or import() are not
// listed there, so they do not count. Polyfills for old browsers (nomodule) are left out.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROUTES = [
  "/",
  "/t",
  "/t/ask",
  "/t/a/[id]",
  "/t/saved",
  "/t/tried/[answerId]",
  "/m",
  "/m/talk",
  "/r",
  "/i",
  "/how",
];
const BUDGET_KB = 200;
const args = new Set(process.argv.slice(2));
const root = process.cwd();
const next = join(root, ".next");

if (!args.has("--no-build")) {
  // Fixture mode: no Supabase keys, so the build never needs a secret and anyone can repeat it.
  execSync("pnpm build", {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  });
}

const build = JSON.parse(readFileSync(join(next, "build-manifest.json"), "utf8"));
const rootMain = build.rootMainFiles ?? [];

function entryFiles(route) {
  const dir = route === "/" ? "" : route;
  const file = join(next, "server", "app", dir, "page_client-reference-manifest.js");
  if (!existsSync(file)) throw new Error(`no client reference manifest for ${route} (${file})`);
  const scope = {};
  // The manifest is a tiny script that assigns to globalThis.__RSC_MANIFEST.
  new Function("globalThis", readFileSync(file, "utf8"))(scope);
  const manifest = Object.values(scope.__RSC_MANIFEST ?? {})[0];
  return Object.values(manifest?.entryJSFiles ?? {}).flat();
}

const gz = new Map();
function gzipKb(rel) {
  if (!gz.has(rel)) {
    const bytes = readFileSync(join(next, rel.replace(/^\/?_next\//, "")));
    gz.set(rel, gzipSync(bytes).length / 1024);
  }
  return gz.get(rel);
}

const rows = ROUTES.map((route) => {
  const files = [...new Set([...rootMain, ...entryFiles(route)])].filter((f) => f.endsWith(".js"));
  const kb = files.reduce((n, f) => n + gzipKb(f), 0);
  return { route, files: files.length, kb: Math.round(kb * 10) / 10 };
});
const shared = Math.round(rootMain.reduce((n, f) => n + gzipKb(f), 0) * 10) / 10;

if (args.has("--json")) {
  console.log(JSON.stringify({ sharedKb: shared, budgetKb: BUDGET_KB, routes: rows }, null, 2));
} else {
  console.log(`\nFirst load JS, gzipped. Shared by every page: ${shared} KB\n`);
  console.log("| Route | Files | First load JS |");
  console.log("|---|---:|---:|");
  for (const r of rows) {
    const flag = r.kb <= BUDGET_KB ? "" : ` (over ${BUDGET_KB} KB)`;
    console.log(`| \`${r.route}\` | ${r.files} | ${r.kb} KB${flag} |`);
  }
}
