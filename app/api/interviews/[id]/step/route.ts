import { importAi } from "@/lib/import/deps";
import { importContext, interviewFor, json, traceIdFor } from "@/lib/import/http";
import { dropChunkWavs, makeQuoteClips } from "@/lib/import/clips";
import { step } from "@/lib/import/pipeline";

// One unit of card extraction (one window of about 10 minutes) per request, so each call fits the
// 300 s Hobby limit (D40). The page calls this until the phase is done; two tabs are safe.
export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<"/api/interviews/[id]/step">) {
  const c = await importContext();
  if (c instanceof Response) return c;
  const { id } = await ctx.params;
  const found = await interviewFor(c, id);
  if (found instanceof Response) return found;
  const ai = importAi();
  if (!ai) return json({ error: "ai_not_ready" }, 503);
  const progress = await step(ai, c.store, { interview: found.interview, traceId: traceIdFor(id) });
  if (progress.phase === "done") {
    // Teachers hear only exact quote clips; the transient chunk copies then go (safety audit).
    await makeQuoteClips(c.db, id).catch(() => 0);
    await dropChunkWavs(c.db, id).catch(() => {});
  }
  return json(progress);
}
