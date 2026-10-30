import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AREAS, DYNAMIC_KEYS, inArea, pickMessages, ROUTE_AREAS, type Area } from "./areas";
import { kn } from "./kn";

// The browser gets only its area's strings (lib/i18n/areas.ts, DESIGN §10). This scans the source:
// for each route folder, every module it renders (server and client, followed through imports),
// and fails when a message key it uses is outside that route's areas, when a key is built at run
// time and not listed in DYNAMIC_KEYS, or when client code imports the dictionary.

const root = process.cwd();
const rel = (f: string) => relative(root, f);
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    if (f === "node_modules" || f.startsWith(".")) return [];
    if (statSync(p).isDirectory()) return walk(p);
    return /\.tsx?$/.test(f) && !/\.(test|spec)\.tsx?$/.test(f) ? [p] : [];
  });
const files = ["app", "components", "lib"].flatMap((d) => walk(join(root, d)));
const src = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
const directive = (f: string, d: string) => new RegExp(`^\\s*["']use ${d}["']`).test(src.get(f)!);

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(root, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (src.has(base + ext)) return base + ext;
  }
  return null;
}

/** Runtime imports only (not `import type`); a server action file is a boundary, never bundled. */
function importsOf(f: string): string[] {
  if (directive(f, "server")) return [];
  const out: string[] = [];
  const re =
    /^\s*(?:import|export)\s+(?!type\b)(?:[^;]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm;
  for (const m of src.get(f)!.matchAll(re)) {
    const hit = resolveImport(f, m[1] ?? m[2] ?? "");
    if (hit) out.push(hit);
  }
  return out;
}

function reach(entries: string[], { clientOnly = false } = {}): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const i of importsOf(f)) stack.push(i);
  }
  if (!clientOnly) return seen;
  return seen;
}

const DICTIONARY = [
  "lib/i18n/kn.ts",
  "lib/i18n/en.ts",
  "lib/i18n/messages.ts",
  "lib/i18n/areas.ts",
];
const isKey = (s: string): s is keyof typeof kn => Object.prototype.hasOwnProperty.call(kn, s);

type Use = { key?: string; dynamic?: string; file: string };

function usesIn(modules: Set<string>): Use[] {
  const out: Use[] = [];
  for (const f of modules) {
    const r = rel(f);
    if (r.startsWith("lib/i18n/")) continue;
    const text = src.get(f)!;
    for (const m of text.matchAll(/["'`]([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+)["'`]/g)) {
      if (isKey(m[1]!)) out.push({ key: m[1], file: r });
    }
    // Keys built at run time: a template with a key-like head, or a cast to MessageKey.
    for (const m of text.matchAll(/`([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9_.]*)\$\{/g)) {
      out.push({ dynamic: m[1], file: r });
    }
    for (const m of text.matchAll(/\bas MessageKey\b/g)) {
      void m;
      out.push({ dynamic: "", file: r });
    }
  }
  return out;
}

function routeEntries(route: string): string[] {
  const full = join(root, route);
  if (route.endsWith(".tsx")) return [full];
  return files.filter(
    (f) =>
      f.startsWith(full + "/") && /\/(page|layout|loading|error|not-found|template)\.tsx$/.test(f),
  );
}

function check(areas: readonly Area[], uses: Use[]): string[] {
  const problems: string[] = [];
  for (const u of uses) {
    if (u.key !== undefined) {
      if (!inArea(u.key, areas))
        problems.push(`${u.file}: "${u.key}" is outside ${["core", ...areas].join("+")}`);
      continue;
    }
    const listed = DYNAMIC_KEYS.filter(
      (d) => d.file === u.file && d.prefix.startsWith(u.dynamic ?? ""),
    );
    if (listed.length === 0) {
      problems.push(
        `${u.file}: a key built at run time (${u.dynamic || "as MessageKey"}) is not listed in DYNAMIC_KEYS`,
      );
      continue;
    }
    for (const d of listed) {
      for (const key of Object.keys(kn).filter((k) => k.startsWith(d.prefix))) {
        if (!inArea(key, areas))
          problems.push(
            `${u.file}: run time key "${key}" is outside ${["core", ...areas].join("+")}`,
          );
      }
    }
  }
  return [...new Set(problems)];
}

const ROOT_ENTRIES = ["app/layout.tsx", "app/error.tsx", "app/not-found.tsx", "app/loading.tsx"]
  .map((f) => join(root, f))
  .filter((f) => src.has(f));

describe("message areas (DESIGN §10: only the strings a route needs reach the browser)", () => {
  it("client code never imports the dictionary", () => {
    const clientRoots = files.filter((f) => directive(f, "client"));
    const client = reach(clientRoots);
    const bad = [...client].filter((f) => DICTIONARY.includes(rel(f))).map(rel);
    expect(bad).toEqual([]);
  });

  it("the root layout and its boundaries use core keys only", () => {
    expect(check([], usesIn(reach(ROOT_ENTRIES)))).toEqual([]);
  });

  for (const [route, areas] of Object.entries(ROUTE_AREAS)) {
    it(`${route} uses only ${["core", ...areas].join(" + ")} keys`, () => {
      const entries = routeEntries(route);
      expect(entries.length).toBeGreaterThan(0);
      expect(check(areas, usesIn(reach(entries)))).toEqual([]);
    });
  }

  it("every route folder with pages is mapped to its areas", () => {
    const routeDirs = new Set(
      files
        .filter((f) => /\/page\.tsx$/.test(f))
        .map((f) => rel(f).split("/").slice(0, 2).join("/"))
        .filter((d) => d !== "app/page.tsx" && !d.startsWith("app/api")),
    );
    const mapped = Object.keys(ROUTE_AREAS);
    expect([...routeDirs].filter((d) => !mapped.includes(d))).toEqual([]);
  });

  it("every listed run time key says why, and its file still builds one", () => {
    for (const d of DYNAMIC_KEYS) {
      expect(d.why.length, d.file).toBeGreaterThan(10);
      expect(src.has(join(root, d.file)), d.file).toBe(true);
    }
  });

  it("picks both languages for exactly an area's keys", () => {
    const teacher = pickMessages(["teacher"]);
    expect(Object.keys(teacher.kn).sort()).toEqual(Object.keys(teacher.en).sort());
    expect(Object.keys(teacher.kn).every((k) => inArea(k, ["teacher"]))).toBe(true);
    expect(teacher.kn["ask.title" as keyof typeof teacher.kn]).toBe(kn["ask.title"]);
    expect(Object.keys(pickMessages(["core"]).kn).length).toBeLessThan(Object.keys(kn).length / 2);
    // Every area names at least one existing key per prefix (no stale prefixes).
    for (const [area, prefixes] of Object.entries(AREAS)) {
      for (const p of prefixes) {
        const hit = Object.keys(kn).some((k) => (p.endsWith(".") ? k.startsWith(p) : k === p));
        expect(hit, `${area}: ${p}`).toBe(true);
      }
    }
  });
});
