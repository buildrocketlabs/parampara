import { getActiveSession } from "@/lib/auth/session";
import { clipPath } from "@/lib/import/clips";
import { json } from "@/lib/import/http";
import { createAdminClient } from "@/lib/supabase/admin";

// "Hear it from the master" and the reviewer's audio jumps: a short lived signed URL of the
// original recording part plus where the moment sits inside it (D18, D39). Who may listen:
// a reviewer (a demo reviewer only to sample recordings, D38), the master themselves, and a teacher
// only when the master allowed voice clips, the moment is cited by an approved card, and no child's
// name was spoken in it (Law 5).
const SIGNED_SECONDS = 600;

type Part = { path: string; mime: string; start_ms: number; duration_ms: number; stored?: boolean };

export async function GET(_req: Request, ctx: RouteContext<"/api/audio/segments/[id]">) {
  const db = createAdminClient();
  if (!db) return json({ error: "not_configured" }, 503);
  const session = await getActiveSession();
  if (!session) return json({ error: "sign_in_needed" }, 401);
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "not_found" }, 404);

  const { data: seg } = await db
    .from("segments")
    .select("id, interview_id, start_ms, end_ms, redacted")
    .eq("id", id)
    .maybeSingle();
  if (!seg) return json({ error: "not_found" }, 404);
  const { data: iv } = await db
    .from("interviews")
    .select("master_id, parts, is_sample")
    .eq("id", seg.interview_id)
    .maybeSingle();
  if (!iv) return json({ error: "not_found" }, 404);
  const { data: master } = await db
    .from("masters")
    .select("profile_id, voice_public")
    .eq("id", iv.master_id)
    .maybeSingle();
  if (!master) return json({ error: "not_found" }, 404);

  let allowed = false;
  if (session.role === "reviewer") allowed = !session.isSample || iv.is_sample;
  else if (session.role === "master") allowed = master.profile_id === session.userId;
  else if (master.voice_public && !seg.redacted) {
    const { count } = await db
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .or(`quote_segment_id.eq.${id},evidence_segment_ids.cs.{${id}}`);
    allowed = (count ?? 0) > 0;
  }
  if (!allowed) return json({ error: "not_allowed" }, 403);

  // A teacher gets the exact quote clip only, never the whole recording (safety audit, 24 Oct).
  if (session.role !== "reviewer" && session.role !== "master") {
    const path = clipPath(seg.interview_id as string, id);
    const { data: clip } = await db.storage
      .from("interviews")
      .createSignedUrl(path, SIGNED_SECONDS);
    if (!clip) return json({ error: "not_stored" }, 409);
    return json(
      {
        url: clip.signedUrl,
        startMs: 0,
        endMs: Number(seg.end_ms) - Number(seg.start_ms),
        mime: "audio/wav",
      },
      200,
      { "cache-control": "private, max-age=300" },
    );
  }

  const parts = (iv.parts as Part[] | null) ?? [];
  const part = parts.find(
    (p) => seg.start_ms >= p.start_ms && seg.start_ms < p.start_ms + p.duration_ms,
  );
  if (!part?.stored) return json({ error: "not_stored" }, 409);
  const { data: signed } = await db.storage
    .from("interviews")
    .createSignedUrl(part.path, SIGNED_SECONDS);
  if (!signed) return json({ error: "not_stored" }, 409);

  return json(
    {
      url: signed.signedUrl,
      startMs: seg.start_ms - part.start_ms,
      endMs: Math.min(seg.end_ms, part.start_ms + part.duration_ms) - part.start_ms,
      mime: part.mime,
    },
    200,
    { "cache-control": "private, max-age=300" },
  );
}
