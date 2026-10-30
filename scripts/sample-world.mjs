// Shared by scripts/seed-sample-library.mjs and scripts/seed-pulse.mjs: loads the Sample world plan
// (lib/seed/*.ts, run directly by Node's type stripping) from the repo's own files. No database,
// no keys: `--dry-run` uses only this.
import { readFileSync } from "node:fs";

// The package has no "type" field, so Node warns that it reparsed each .ts file as ESM; that one
// warning is noise here and is dropped.
const emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const code = typeof rest[0] === "object" ? rest[0]?.code : rest[1];
  if (code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  return emitWarning.call(this, warning, ...rest);
};

const world = await import("../lib/seed/sample-world.ts");
const library = await import("../lib/seed/library-plan.ts");
const pulse = await import("../lib/seed/pulse-plan.ts");
const { findUnsafe } = await import("../ai/safety/patterns.ts");

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

// The eval library carries adversarial cards (an injected instruction, unsafe advice) on purpose.
// They test the pipeline; they must never be seeded as approved practice (M5 safety audit).
const INJECTION = /ignore (all )?(previous|prior) instructions|system prompt|you are now/i;
function isAdversarial(c) {
  const text = JSON.stringify([c.title, c.problem, c.steps, c.materials, c.why]);
  return INJECTION.test(text) || findUnsafe(text).length > 0;
}

export function loadLibraryPlan() {
  return library.buildLibraryPlan({
    evalCards: read("../evals/library.json").cards,
    worldCards: read("../lib/seed/sample-world-cards.json").cards,
    isAdversarial,
  });
}

export { library, pulse, world };

export const args = new Set(process.argv.slice(2));
export const DRY_RUN = args.has("--dry-run");
export const RESET = args.has("--reset-sample");

export function adminClientOrExit(createClient, command) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      `  ✗ Supabase keys missing (run the keys script in your Terminal), or try pnpm ${command} --dry-run. Nothing was written.`,
    );
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function fail(what, error) {
  console.error(
    `  ✗ ${what}${error?.code ? ` (${error.code})` : error?.message ? ` (${error.message})` : ""}`,
  );
  process.exit(1);
}

/** Every auth user by lower case email (the admin API has no lookup by email). */
export async function usersByEmail(db) {
  const users = new Map();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail("list users", error);
    for (const u of data.users) if (u.email) users.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }
  return users;
}

export const tally = (xs) =>
  Object.entries(xs.reduce((o, x) => ((o[x] = (o[x] ?? 0) + 1), o), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join(", ");
