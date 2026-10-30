import { cookies } from "next/headers";

// A phone that joined through a group QR remembers which link is its own (D80), so a second scan
// (the session ended, or the headmaster's QR is still on screen) brings it back to the same
// account instead of taking another place. HttpOnly, like the session itself; the value is that
// person's own invite code, the credential the session came from anyway.
export const GROUP_CHILD_COOKIE = "pp_group_child";

const OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/join",
  secure: Boolean(process.env.VERCEL),
  maxAge: 60 * 60 * 24 * 180,
} as const;

/** This phone's own code from this group, if it joined through it before. */
export async function rememberedGroupChild(groupCode: string): Promise<string | null> {
  const value = (await cookies()).get(GROUP_CHILD_COOKIE)?.value ?? "";
  const [group, child] = value.split(":");
  return group === groupCode && child ? child : null;
}

/** Server actions only (cookies can be set there, not while a page renders). */
export async function rememberGroupChild(groupCode: string, childCode: string): Promise<void> {
  (await cookies()).set(GROUP_CHILD_COOKIE, `${groupCode}:${childCode}`, OPTIONS);
}
