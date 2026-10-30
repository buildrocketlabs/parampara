import { hasSarvam } from "@/lib/env";
import { maxImportMs } from "@/lib/import/access";
import { importAi } from "@/lib/import/deps";
import { importContext, interviewFor, json, traceIdFor } from "@/lib/import/http";
import { questionTrusted, serverTalkKey } from "@/lib/talk/sign";
import { activeElapsedMs, appendTurn, consentOnRecord, listTurns, readLive, startLiveInterview, TurnBody, TurnError } from "@/lib/talk/turns";

// A live interview, turn by turn (docs/BUILD.md M4.3). POST the consent recording to create it
// under the id the page chose (a retry is harmless), then one POST per answer: a voice answer's
// part and chunk plan, or a typed answer that is redacted before it is stored. GET lists the turns
// with their redacted words and the talk time so far, so a reopened page continues where it stopped.
// A skipped question is a turn too (kind skip): it is kept, so it is not asked again after a reload. An answer is taken only
// once the master's consent is on record, and only under a question the server wrote itself.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: RouteContext<"/api/interviews/[id]/turns">) {
  const c = await importContext();
  if (c instanceof Response) return c;
  const { id } = await ctx.params;
  const found = await interviewFor(c, id);
  if (found instanceof Response) return found;
  const live = await readLive(c.db, id);
  if (!live) return json({ error: "not_found" }, 404);
  return json({
    status: live.status,
    startedAt: live.startedAt,
    // Time spent talking, breaks left out: a reopened page carries on from here.
    elapsedMs: activeElapsedMs(live, Date.now()),
    turns: await listTurns(c.db, live),
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/interviews/[id]/turns">) {
  const c = await importContext();
  if (c instanceof Response) return c;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return json({ error: "not_found" }, 404);
  const parsed = TurnBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const body = parsed.data;
  try {
    if (body.kind === "consent") {
      const { data: m } = await c.db
        .from("masters")
        .select("id, profile_id, is_sample")
        .eq("id", body.masterId)
        .maybeSingle();
      if (!m) return json({ error: "master_not_found" }, 404);
      const onRecord = body.audio ? false : await consentOnRecord(c.db, m.id);
      const master = { id: m.id, profileId: m.profile_id, isSample: m.is_sample, consentOnRecord: onRecord };
      return json(await startLiveInterview(c.db, c.session, master, id, body, hasSarvam()), 201);
    }
    const found = await interviewFor(c, id);
    if (found instanceof Response) return found;
    const live = await readLive(c.db, id);
    if (!live) return json({ error: "not_found" }, 404);
    const ai = importAi();
    if (!ai) return json({ error: "ai_not_ready" }, 503);
    const [master, consented] = await Promise.all([c.store.getMasterContext(live.masterId), consentOnRecord(c.db, live.masterId)]);
    const key = serverTalkKey();
    const result = await appendTurn(c.db, live, body, {
      speechReady: hasSarvam(),
      redact: (input) => ai.redact(input),
      masterName: master.name,
      traceId: traceIdFor(id),
      consented,
      trustQuestion: (q) => questionTrusted(key, id, q, q.sig),
      maxMs: maxImportMs(c.session),
    });
    return json(result, 201);
  } catch (err) {
    if (err instanceof TurnError) return json({ error: err.code }, err.status);
    throw err;
  }
}
