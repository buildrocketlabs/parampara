import { lineSpeaker } from "@/ai";
import { getActiveSession } from "@/lib/auth/session";
import {
  spokenLines,
  storeAnswerVoice,
  VOICE_LANG_CODE,
  voicePath,
  type VoiceLang,
} from "@/lib/answers/voice";
import { hasSarvam } from "@/lib/env";
import { json } from "@/lib/import/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// The answer, spoken (DESIGN §4 VoicePlayer, docs/AI.md §4: voice follows the text). Made once per
// answer in the teacher's language and kept in the private `answers` bucket; every later play is a
// short lived signed URL. Read access is the teacher's own (RLS answers_own) or a reviewer's.
// A fresh answer's voice is already being made by the ask route (D86), so this waits for it a
// little before making it again; a replayed answer carries its original's file (copyAnswer).
export const maxDuration = 60;
const SIGNED_SECONDS = 3600;
/** An answer this young is still being voiced by the ask route that made it. */
const FRESH_MS = 60_000;
const WAIT_MS = 9_000;
const POLL_MS = 300;

type Tri = { kn: string; en: string; hi?: string | null };
type Row = {
  id: string;
  status: string;
  lang: string | null;
  created_at: string | null;
  replayed: boolean | null;
  replayed_from: string | null;
  title_kn: string | null;
  title_en: string | null;
  title_hi: string | null;
  steps: unknown;
  why: unknown;
  audio_path: string | null;
};

export async function GET(_req: Request, ctx: RouteContext<"/api/answers/[id]/voice">) {
  const admin = createAdminClient();
  const db = await createClient();
  if (!admin || !db) return json({ error: "not_configured" }, 503);
  const session = await getActiveSession();
  if (!session) return json({ error: "sign_in_needed" }, 401);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "not_found" }, 404);

  // Her own client first: if RLS does not show her this answer, nobody hears it.
  const read = async () =>
    (
      await db
        .from("answers")
        .select(
          "id, status, lang, created_at, replayed, replayed_from, title_kn, title_en, title_hi, steps, why, audio_path",
        )
        .eq("id", id)
        .maybeSingle()
    ).data as Row | null;
  const a = await read();
  if (!a || a.status !== "answered") return json({ error: "not_found" }, 404);

  const bucket = admin.storage.from("answers");
  let path = a.audio_path;
  const age = a.created_at ? Date.now() - Date.parse(a.created_at) : Infinity;
  if (!path && !a.replayed && age < FRESH_MS) {
    const until = Date.now() + WAIT_MS;
    while (!path && Date.now() < until) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      path = (await read())?.audio_path ?? null;
    }
  }
  if (!path) {
    if (!hasSarvam()) return json({ error: "voice_not_ready" }, 503);
    const lang = ((a.lang as VoiceLang | null) ?? "kn") as VoiceLang;
    const lines = spokenLines(lang, {
      title: { kn: a.title_kn ?? "", en: a.title_en ?? "", hi: a.title_hi },
      steps: (a.steps as Tri[]) ?? [],
      why: (a.why as Tri | null) ?? null,
    });
    try {
      const voice = await lineSpeaker({
        codec: "mp3",
        languageCode: VOICE_LANG_CODE[lang],
        traceId: id,
      }).build(lines);
      if (!(await storeAnswerVoice(admin, id, voice.audio, voice.mime)))
        return json({ error: "voice_failed" }, 502);
      path = voicePath(id);
      // A replay of an answer that had no voice yet: the original keeps this one, so every later
      // replay (a sample chip on the shared demo account) is heard at once.
      if (a.replayed_from)
        await admin
          .from("answers")
          .update({ audio_path: path })
          .eq("id", a.replayed_from)
          .is("audio_path", null);
    } catch (err) {
      const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;
      if (typeof retryAfterMs === "number")
        return json({ error: "rate_limited", retryAfterMs }, 429);
      return json({ error: "voice_failed" }, 502);
    }
  }
  const { data: signed } = await bucket.createSignedUrl(path, SIGNED_SECONDS);
  if (!signed) return json({ error: "voice_failed" }, 502);
  return json({ url: signed.signedUrl, mime: "audio/mpeg" }, 200, {
    "cache-control": "private, max-age=600",
  });
}
