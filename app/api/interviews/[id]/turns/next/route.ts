import { importContext, interviewFor, json, traceIdFor } from "@/lib/import/http";
import { nextQuestion, talkAi } from "@/lib/talk/next";
import { serverTalkKey, signQuestion, signSay } from "@/lib/talk/sign";
import { consentOnRecord, readLive } from "@/lib/talk/turns";

// Hanate's next question, from the redacted conversation so far (docs/BUILD.md M4.3). If the
// interviewer model cannot answer in time, the interview guide's next question comes back instead.
// The question is signed for this interview, so only it can be stored and said aloud; an answer that
// spoke of a child in danger or of despair comes back with `care`, and the screen shows the helpline.
export const maxDuration = 30;

export async function POST(_req: Request, ctx: RouteContext<"/api/interviews/[id]/turns/next">) {
  const c = await importContext();
  if (c instanceof Response) return c;
  const { id } = await ctx.params;
  const found = await interviewFor(c, id);
  if (found instanceof Response) return found;
  const live = await readLive(c.db, id);
  if (!live) return json({ error: "not_found" }, 404);
  if (live.status !== "recording") return json({ error: "interview_closed" }, 409);
  if (!(await consentOnRecord(c.db, live.masterId))) return json({ error: "consent_missing" }, 409);
  // Skipped questions are parts of the talk (POST turns, kind skip), so a reopened page and this
  // route agree on everything asked so far.
  const next = await nextQuestion(c.db, c.store, live, talkAi, traceIdFor(id));
  const key = serverTalkKey();
  const q = next.question;
  const signed = { kn: q.questionKn, en: q.questionEn, topic: q.topic, probe: q.probe };
  return json({
    question: q,
    source: next.source,
    care: next.care,
    sig: key ? signQuestion(key, id, signed) : null,
    sayToken: key ? signSay(key, q.questionKn) : null,
  });
}
