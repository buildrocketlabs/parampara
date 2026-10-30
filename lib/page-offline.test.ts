import { describe, expect, it } from "vitest";
import { isNetworkFailure } from "./page-offline";

describe("a page that could not load for want of a network (F-P2)", () => {
  it("is offline whenever the browser says so, whatever the error", () => {
    expect(isNetworkFailure(new Error("anything"), false)).toBe(true);
  });

  it("is a network failure when a chunk or a fetch could not load, even if onLine says true", () => {
    const chunk = new Error("Failed to load chunk /_next/static/chunks/x.js from module 1");
    chunk.name = "ChunkLoadError";
    expect(isNetworkFailure(chunk, true)).toBe(true);
    expect(isNetworkFailure(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(isNetworkFailure(new TypeError("Load failed"), true)).toBe(true);
    expect(
      isNetworkFailure(new TypeError("NetworkError when attempting to fetch resource."), true),
    ).toBe(true);
  });

  it("is a real error otherwise, so a fault is never hidden behind 'no network'", () => {
    expect(isNetworkFailure(new Error("Cannot read properties of undefined"), true)).toBe(false);
    expect(isNetworkFailure("weird", true)).toBe(false);
  });
});
