import { afterEach, describe, expect, it, vi } from "vitest";
import { groupState, isGroupInvite } from "./types";

// Group invites (D80): the state a scan meets, and the fixture store's one-place-per-scan rule.

const group = {
  revokedAt: null as string | null,
  maxUses: 3 as number | null,
  expiresAt: "2026-10-30T00:00:00Z" as string | null,
  useCount: 0,
};
const now = new Date("2026-10-29T10:00:00Z");

describe("groupState", () => {
  it("is open with the places left", () => {
    expect(groupState({ ...group, useCount: 1 }, now)).toEqual({ kind: "open", left: 2 });
  });
  it("is full once every place is taken, never negative", () => {
    expect(groupState({ ...group, useCount: 3 }, now)).toEqual({ kind: "full" });
    expect(groupState({ ...group, useCount: 9 }, now)).toEqual({ kind: "full" });
  });
  it("is over at its time, and closed wins over everything", () => {
    expect(groupState({ ...group, expiresAt: "2026-10-29T10:00:00Z" }, now)).toEqual({
      kind: "expired",
    });
    expect(groupState({ ...group, revokedAt: "2026-10-29T09:00:00Z", useCount: 3 }, now)).toEqual({
      kind: "closed",
    });
  });
  it("needs no expiry to stay open", () => {
    expect(groupState({ ...group, expiresAt: null }, now)).toEqual({ kind: "open", left: 3 });
  });
  it("tells a group from a one person link", () => {
    expect(isGroupInvite({ maxUses: 15 })).toBe(true);
    expect(isGroupInvite({ maxUses: null })).toBe(false);
  });
});

describe("fixture group joins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as { __paramparaInvites?: unknown }).__paramparaInvites;
  });

  it("mints one Sample person per scan and refuses past the limit", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { joinGroup } = await import("./store");
    const { fixtureInvites } = await import("./fixture-store");
    fixtureInvites().get("SAMPLE-G1")!.maxUses = 2;

    const a = await joinGroup("SAMPLE-G1");
    const b = await joinGroup("SAMPLE-G1");
    const c = await joinGroup("SAMPLE-G1");
    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");
    expect(c.status).toBe("full");
    if (a.status !== "ok" || b.status !== "ok") throw new Error("unreachable");
    expect(a.child.code).not.toBe(b.child.code);
    expect(a.child).toMatchObject({
      parentCode: "SAMPLE-G1",
      isSample: true,
      role: "teacher",
      maxUses: null,
    });
    expect(fixtureInvites().get("SAMPLE-G1")!.useCount).toBe(2);
  });

  it("says why a scan gets no place", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { joinGroup } = await import("./store");
    expect((await joinGroup("SAMPLE-G0")).status).toBe("full");
    expect((await joinGroup("SAMPLE-GE")).status).toBe("expired");
    expect((await joinGroup("SAMPLE-T1")).status).toBe("unknown");
    expect((await joinGroup("NOPE-NOPE")).status).toBe("unknown");
  });

  it("keeps a field group's people field (not Sample)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { joinGroup } = await import("./store");
    const joined = await joinGroup("TEST-FIELD-G1");
    expect(joined.status === "ok" && joined.child.isSample).toBe(false);
  });
});
