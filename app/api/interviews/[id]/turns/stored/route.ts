import { z } from "zod";
import { importContext, interviewFor, json } from "@/lib/import/http";
import { markStored, TurnError } from "@/lib/talk/turns";

// A live interview part's original audio is in storage (checked, not trusted). For the consent
// part, this is the moment the master's consent goes on record (M4 safety audit, 24 Oct). Live
// interviews use this instead of the import PATCH, whose write could drop a newer turn's part.
const Body = z.object({ part: z.number().int().min(0).max(200) });

export async function POST(req: Request, ctx: RouteContext<"/api/interviews/[id]/turns/stored">) {
  const c = await importContext();
  if (c instanceof Response) return c;
  const { id } = await ctx.params;
  const found = await interviewFor(c, id);
  if (found instanceof Response) return found;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "invalid" }, 400);
  try {
    return json(await markStored(c.db, id, body.data.part));
  } catch (err) {
    if (err instanceof TurnError) return json({ error: err.code }, err.status);
    throw err;
  }
}
