import { createInterview, CreateInterviewSchema } from "@/lib/import/create";
import { importContext, json } from "@/lib/import/http";

// Starts a recording import from the plan the browser made (lib/audio): interview, parts, chunks.
export async function POST(request: Request) {
  const ctx = await importContext();
  if (ctx instanceof Response) return ctx;
  const parsed = CreateInterviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);

  const { data: m } = await ctx.db
    .from("masters")
    .select("id, profile_id, is_sample, consented_at")
    .eq("id", parsed.data.masterId)
    .maybeSingle();
  if (!m) return json({ error: "master_not_found" }, 404);

  const result = await createInterview(
    ctx.db,
    ctx.session,
    { id: m.id, profileId: m.profile_id, isSample: m.is_sample, consentedAt: m.consented_at },
    parsed.data,
  );
  if (!result.ok) return json({ error: result.error }, result.status);
  return json(result, 201);
}
