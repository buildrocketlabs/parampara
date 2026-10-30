import { describe, expect, it } from "vitest";
import { parseIds, pushRecent, RECENT_MAX } from "./on-phone";

describe("answers kept on the phone (F-P1)", () => {
  it("keeps the answer just opened first, once, and at most ten", () => {
    expect(pushRecent([], "a")).toEqual(["a"]);
    expect(pushRecent(["b", "a", "c"], "a")).toEqual(["a", "b", "c"]);
    const many = Array.from({ length: RECENT_MAX }, (_, i) => `id${i}`);
    const next = pushRecent(many, "new");
    expect(next).toHaveLength(RECENT_MAX);
    expect(next[0]).toBe("new");
    expect(next).not.toContain(`id${RECENT_MAX - 1}`);
  });

  it("reads only a list of ids, whatever the store holds", () => {
    expect(parseIds(null)).toEqual([]);
    expect(parseIds("not json")).toEqual([]);
    expect(parseIds('{"a":1}')).toEqual([]);
    expect(parseIds('["a", 2, "b"]')).toEqual(["a", "b"]);
  });
});
