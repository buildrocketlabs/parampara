import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HeardFile, heardEntries } from "./heard";
import raw from "@/docs/field/heard.json";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

describe("what we heard and what we changed", () => {
  it("is a valid file with entries", () => {
    expect(HeardFile.safeParse(raw).success).toBe(true);
    expect(heardEntries().length).toBeGreaterThan(0);
  });

  it("marks only the synthetic probe as Sample", () => {
    for (const e of heardEntries()) expect(e.sample).toBe(e.who === "probe");
  });

  it("quotes only what was heard: a seen item carries no quote marks", () => {
    for (const e of heardEntries().filter((x) => x.kind === "saw")) {
      expect(e.heard.en).not.toMatch(/[“”"]/);
      expect(e.heard.kn).not.toMatch(/[“”"]/);
    }
  });

  it("is mirrored row for row in the README and docs/field/CHANGES.md", () => {
    for (const file of ["README.md", "docs/field/CHANGES.md"]) {
      const rows = read(file)
        .split("\n")
        .filter((l) => /^\| \d{1,2} Oct \|/.test(l));
      expect(rows).toHaveLength(heardEntries().length);
      for (const e of heardEntries()) {
        const row = rows.find((r) => r.startsWith(`| ${day(e.date)} |`) && r.includes(e.where[0]!));
        expect(row, `${file}: ${e.date} ${e.where[0]}`).toBeDefined();
        if (e.sample) expect(row).toContain("Sample");
      }
    }
  });

  it("names a decision that exists, or a file that exists", () => {
    const decisions = read("docs/DECISIONS.md");
    for (const e of heardEntries()) {
      for (const w of e.where) {
        if (/^D\d+$/.test(w)) expect(decisions).toContain(`**${w}.**`);
        else if (!w.startsWith("/"))
          expect(() =>
            read(w.replace(/\/$/, "") + (w.includes(".") ? "" : "/page.tsx")),
          ).not.toThrow();
      }
    }
  });
});
