import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteEmail } from "@/lib/invites/code";
import { recordInviteOpen } from "@/lib/invites/store";
import type { Invite } from "@/lib/invites/types";

// Live mode only: opening /join/<code> signs in the invite's hidden user on the server (D37).
// No password and no email: the admin API mints a one time token and the cookie bound server
// client spends it at once, so the session cookie is set on this response.
// The same link works again on a second phone or after cleared storage, because the hidden user
// belongs to the invite, not to a browser.
export async function signInWithInvite(
  invite: Invite,
  opts: {
    /** She read the consent text on the join page and pressed I agree there (group scan, D83). */
    agreed?: { version: string };
  } = {},
): Promise<{ consented: boolean }> {
  // A group QR is many people's door, never one person's account (D80).
  if (invite.maxUses !== null) throw new Error("invite: a group has no person of its own");
  const admin = createAdminClient();
  const supabase = await createClient();
  if (!admin || !supabase) throw new Error("invite: database is not configured");

  // 1. The hidden user. A master added by a reviewer already has one (used_by set at creation),
  //    so its email is read rather than assumed.
  let email = inviteEmail(invite.code);
  if (invite.usedBy) {
    const { data, error } = await admin.auth.admin.getUserById(invite.usedBy);
    if (error || !data.user?.email) throw new Error(`invite: user lookup failed (${error?.code})`);
    email = data.user.email;
  } else {
    const { error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { source: "invite" },
    });
    // email_exists: an earlier first open stopped half way; carry on with that user.
    if (error && error.code !== "email_exists") {
      throw new Error(`invite: user create failed (${error.code})`);
    }
  }

  // 2. The one time token. generateLink also returns the user, so a half finished first open
  //    still learns the id here.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link.properties?.hashed_token || !link.user?.id) {
    throw new Error(`invite: token failed (${linkError?.code})`);
  }
  const userId = link.user.id;

  // 3. First open: the profile that grants the role. ignoreDuplicates keeps an existing row (and
  //    its consent) untouched; used_by is claimed only while still empty.
  if (!invite.usedBy) {
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        role: invite.role,
        district: invite.district,
        is_sample: invite.isSample,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (profileError) throw new Error(`invite: profile failed (${profileError.code})`);
    const { error: claimError } = await admin
      .from("invites")
      .update({ used_by: userId, used_at: new Date().toISOString() })
      .eq("code", invite.code)
      .is("used_by", null);
    if (claimError) throw new Error(`invite: claim failed (${claimError.code})`);
  }

  // 4. Spend the token on the cookie bound client: this sets the session cookies.
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) throw new Error(`invite: sign in failed (${verifyError.code})`);

  await recordInviteOpen(invite);

  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("consented_at")
    .eq("id", userId)
    .maybeSingle();
  if (readError) throw new Error(`invite: profile read failed (${readError.code})`);
  if (profile?.consented_at || !opts.agreed) return { consented: Boolean(profile?.consented_at) };

  // Agreed on the join page: the same record /welcome writes (time and text version).
  const { error: consentError } = await admin
    .from("profiles")
    .update({ consented_at: new Date().toISOString(), consent_version: opts.agreed.version })
    .eq("id", userId)
    .is("consented_at", null);
  if (consentError) throw new Error(`invite: consent failed (${consentError.code})`);
  return { consented: true };
}
