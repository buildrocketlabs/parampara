import { AUTH_EMAIL_DOMAIN } from "@/lib/auth/roles";

// Invite codes (DECISIONS D37). A code is the whole credential, so it is random, and it is read
// aloud or squinted at on a phone, so it avoids look alike characters: no 0/O, no 1/I/L.
export const INVITE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 8;

// 256 is not a multiple of 31; bytes at or above this limit are dropped so every character is
// equally likely (no modulo bias).
const BYTE_LIMIT = 256 - (256 % INVITE_ALPHABET.length);

type RandomBytes = (bytes: Uint8Array) => Uint8Array;
const cryptoBytes: RandomBytes = (bytes) => globalThis.crypto.getRandomValues(bytes);

export function generateInviteCode(random: RandomBytes = cryptoBytes): string {
  let code = "";
  while (code.length < INVITE_CODE_LENGTH) {
    for (const byte of random(new Uint8Array(16))) {
      if (byte >= BYTE_LIMIT) continue;
      code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
      if (code.length === INVITE_CODE_LENGTH) break;
    }
  }
  return code;
}

/** Codes are case insensitive and survive a stray space from copy and paste. */
export function normalizeInviteCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/** Shape check before any lookup. Older and sample codes (SAMPLE-T1) may use a hyphen. */
export function isInviteCodeShape(code: string): boolean {
  return /^[A-Z0-9-]{6,32}$/.test(code);
}

/** For reading on screen: K7QM 3XRP. The link always carries the plain code. */
export function formatInviteCode(code: string): string {
  return code.length === INVITE_CODE_LENGTH ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

/** Each invite owns one hidden auth user on a reserved domain; no mail is ever sent to it. */
export function inviteEmail(code: string): string {
  return `invite-${code.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}
