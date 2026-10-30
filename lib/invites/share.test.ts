import { describe, expect, it } from "vitest";
import { kn } from "@/lib/i18n/kn";
import { inviteLink, shareMessage, whatsappHref } from "./share";
import { inviteStatus } from "./types";

describe("invite sharing", () => {
  it("builds the join link on the given base, without a double slash", () => {
    expect(inviteLink("https://parampara-eta.vercel.app/", "K7QM3XRP")).toBe(
      "https://parampara-eta.vercel.app/join/K7QM3XRP",
    );
  });

  it("writes a Kannada message with the link in it, respectful and short", () => {
    const link = "https://parampara-eta.vercel.app/join/K7QM3XRP";
    for (const role of ["teacher", "master", "reviewer"] as const) {
      const text = shareMessage(role, link);
      expect(text).toContain(link);
      expect(text).not.toContain("{link}");
      expect(text).toMatch(/[ಀ-೿]/);
      expect(text.length).toBeLessThan(400);
    }
    expect(shareMessage("teacher", link)).toContain("ಮೇಡಂ");
    expect(kn["share.teacher"]).toContain("ನಿಮ್ಮ");
  });

  it("opens WhatsApp's chooser with the whole message encoded", () => {
    const href = whatsappHref("ನಮಸ್ಕಾರ! https://x.test/join/AB23CD45\nಸಾಲು");
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(href.slice("https://wa.me/?text=".length))).toBe(
      "ನಮಸ್ಕಾರ! https://x.test/join/AB23CD45\nಸಾಲು",
    );
  });

  it("reports status from the row: revoked wins, then opens", () => {
    expect(inviteStatus({ revokedAt: null, useCount: 0 })).toEqual({ kind: "unopened" });
    expect(inviteStatus({ revokedAt: null, useCount: 3 })).toEqual({ kind: "opened", count: 3 });
    expect(inviteStatus({ revokedAt: "2026-10-24T00:00:00Z", useCount: 3 })).toEqual({
      kind: "revoked",
    });
  });
});
