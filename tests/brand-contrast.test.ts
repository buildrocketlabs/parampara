import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colors, contrast, contrastPairs } from "@/lib/tokens";

const MIN = { normal: 4.5, large: 3 } as const;

describe("brand contrast (DESIGN.md §3)", () => {
  for (const { fg, bg, stated, usage } of contrastPairs) {
    const ratio = contrast(colors[fg], colors[bg]);

    it(`${fg} on ${bg} meets ${usage} text (${MIN[usage]}:1)`, () => {
      expect(ratio).toBeGreaterThanOrEqual(MIN[usage]);
    });

    if (stated !== undefined) {
      it(`${fg} on ${bg} matches the stated ${stated}:1`, () => {
        expect(ratio).toBeCloseTo(stated, 1);
      });
    }
  }
});

describe("globals.css mirrors lib/tokens.ts", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").toLowerCase();

  // DESIGN's `muted` text colour is shadcn's `muted-foreground` (shadcn owns `muted` as a surface).
  const cssVar = (name: string) => (name === "muted" ? "--muted-foreground" : `--color-${name}`);

  for (const [name, hex] of Object.entries(colors)) {
    it(`${cssVar(name)} is ${hex}`, () => {
      expect(css).toContain(`${cssVar(name)}: ${hex.toLowerCase()};`);
    });
  }
});
