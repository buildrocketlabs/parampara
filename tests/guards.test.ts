import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Self test for the isolation hooks (CLAUDE.md Laws 1 and 2, docs/SETUP.md). Feeds sample tool
// calls to the PreToolUse scripts exactly as Claude Code does and checks block (exit 2) or allow.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function run(script: string, payload: unknown): number {
  const res = spawnSync("bash", [`${ROOT}scripts/hooks/${script}`], {
    input: JSON.stringify(payload),
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT.replace(/\/$/, "") },
    encoding: "utf8",
  });
  return res.status ?? -1;
}

const bash = (command: string) => run("guard-commands.sh", { tool_input: { command } });
const path = (tool: string, file_path: string) =>
  run("guard-paths.sh", { tool_name: tool, tool_input: { file_path } });

describe("guard-commands", () => {
  it.each([
    "gh auth switch --user someone",
    "gh repo list",
    "git config --global user.name x",
    "git push --force origin main",
    "git push origin :main",
    "git reset --hard HEAD~1",
    "vercel deploy",
    "npx vercel@latest",
    "./scripts/vc.sh env ls",
    "./scripts/vc.sh deploy --prod",
    "supabase login",
    "pnpm exec supabase link --project-ref abc",
    "pnpm exec supabase projects list",
    "pnpm exec supabase db push",
    "pnpm exec supabase db push --linked",
    "SUPABASE_ACCESS_TOKEN=x pnpm db:push",
    "./scripts/keys.sh --check",
    "cat .env.local",
    "grep KEY .env",
    "echo $ANTHROPIC_API_KEY",
    "printenv",
    "git remote add other https://github.com/someone-else/x.git",
    "pnpm add -g something",
  ])("blocks %s", (cmd) => {
    expect(bash(cmd)).toBe(2);
  });

  it.each([
    "git status",
    "pnpm test",
    "pnpm typecheck && pnpm lint",
    "./scripts/gh.sh pr list",
    "./scripts/gh.sh run list --limit 3",
    "ALLOW_DB_PUSH=1 pnpm db:push",
    "git add supabase/migrations/0002_storage.sql",
    "ls supabase/migrations",
    "node --env-file-if-exists=.env.local scripts/smoke.mjs",
    "git push origin main",
  ])("allows %s", (cmd) => {
    expect(bash(cmd)).toBe(0);
  });
});

describe("guard-paths", () => {
  it.each([
    ["Read", ".env.local"],
    ["Read", ".env"],
    ["Write", ".env.local"],
    ["Write", "scripts/hooks/guard-commands.sh"],
    ["Edit", "scripts/db-push.sh"],
    ["Write", "supabase/.project-ref"],
    ["Write", ".claude/settings.json"],
    ["Write", "pnpm-lock.yaml"],
    ["Write", "/tmp/elsewhere.txt"],
    ["Read", "/Users/someone/.ssh/id_ed25519"],
    ["Read", "supabase/.temp/project-ref"],
  ])("blocks %s %s", (tool, file) => {
    expect(path(tool, file)).toBe(2);
  });

  it.each([
    ["Read", ".env.example"],
    ["Write", "app/page.tsx"],
    ["Edit", "supabase/migrations/0002_storage.sql"],
    ["Read", "docs/BUILD.md"],
  ])("allows %s %s", (tool, file) => {
    expect(path(tool, file)).toBe(0);
  });
});
