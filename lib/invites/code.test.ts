import { describe, expect, it } from "vitest";
import {
  formatInviteCode,
  generateInviteCode,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  inviteEmail,
  isInviteCodeShape,
  normalizeInviteCode,
} from "./code";

describe("invite codes", () => {
  it("uses the shared unambiguous alphabet (scripts/invite.mjs uses the same one)", () => {
    expect(INVITE_ALPHABET).toBe("23456789ABCDEFGHJKMNPQRSTUVWXYZ");
    expect(INVITE_ALPHABET).not.toMatch(/[01ILO]/);
    expect(new Set(INVITE_ALPHABET).size).toBe(INVITE_ALPHABET.length);
  });

  it("makes 8 characters, all from the alphabet, different each time", () => {
    const codes = Array.from({ length: 500 }, () => generateInviteCode());
    for (const code of codes) {
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect([...code].every((ch) => INVITE_ALPHABET.includes(ch))).toBe(true);
      expect(isInviteCodeShape(code)).toBe(true);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("drops biased bytes instead of folding them (no modulo bias)", () => {
    // 248..255 would wrap onto the first 8 characters; they must be skipped.
    let call = 0;
    const bytes = (b: Uint8Array) => {
      b.fill(call++ === 0 ? 250 : 0);
      return b;
    };
    expect(generateInviteCode(bytes)).toBe("22222222");
    let n = 0;
    const counting = (b: Uint8Array) => {
      for (let i = 0; i < b.length; i++) b[i] = n++ % 31;
      return b;
    };
    expect(generateInviteCode(counting)).toBe("23456789");
  });

  it("is case insensitive and forgives stray spaces from WhatsApp", () => {
    expect(normalizeInviteCode(" k7qm 3xrp ")).toBe("K7QM3XRP");
    expect(normalizeInviteCode("sample-t1")).toBe("SAMPLE-T1");
  });

  it("refuses shapes that could never be a code", () => {
    for (const bad of ["", "ABC", "K7QM3XRP;drop", "../etc", "A".repeat(33), "ಕನ್ನಡ"]) {
      expect(isInviteCodeShape(normalizeInviteCode(bad)), bad).toBe(false);
    }
    expect(isInviteCodeShape("SAMPLE-T1")).toBe(true);
  });

  it("groups for reading and keeps the hidden email lowercase on the reserved domain", () => {
    expect(formatInviteCode("K7QM3XRP")).toBe("K7QM 3XRP");
    expect(formatInviteCode("SAMPLE-T1")).toBe("SAMPLE-T1");
    expect(inviteEmail("K7QM3XRP")).toBe("invite-k7qm3xrp@parampara.invalid");
  });
});
