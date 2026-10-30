import { z } from "zod";
import { importContext, interviewFor, json } from "@/lib/import/http";
import { markConsentIfStored } from "@/lib/import/create";
import { revalidateOpenCards } from "@/lib/open/load";
import { progress } from "@/lib/import/pipeline";

// Where an import stands, so a reopened page resumes: which chunks are done, the latest redacted
// lines (the transcript filling in live), extraction windows and draft cards so far.
export async function GET(_req: Request, ctx: RouteContext<"/api/interviews/[id]">) {
  const c = await importContext();
  if (c instanceof Response) return c;
  const { id } = await ctx.params;
  const found = await interviewFor(c, id);
  if (found instanceof Response) return found;
  const { interview } = found;

  const [chunks, recent, row, welfareJobs] = await Promise.all([
    c.db.from("audio_chunks").select("idx, status").eq("interview_id", id).order("idx"),
    c.db
      .from("segments")
      .select("start_ms, end_ms, text_kn, text_en")
      .eq("interview_id", id)
      .order("start_ms", { ascending: false })
      .limit(6),
    c.db.from("interviews").select("title, parts, duration_ms").eq("id", id).single(),
    c.db.from("jobs").select("result").eq("interview_id", id).eq("status", "done"),
  ]);
  // Moments where the master mentions harm to a child: a reviewer listens to each (Law 5).
  const welfare = [
    ...new Set(
      (welfareJobs.data ?? []).flatMap(
        (j) => (j.result as { welfareSegmentIds?: number[] } | null)?.welfareSegmentIds ?? [],
      ),
    ),
  ];
  const phase =
    interview.status === "done"
      ? "done"
      : interview.status === "failed"
        ? "needs_attention"
        : interview.status === "extracting"
          ? "extracting"
          : "transcribing";
  return json({
    interview: { ...interview, title: row.data?.title ?? null },
    progress: await progress(c.store, id, phase),
    welfare,
    chunks: (chunks.data ?? []).map((ch) => ({ idx: ch.idx, status: ch.status })),
    recent: (recent.data ?? []).reverse().map((s) => ({
      startMs: s.start_ms,
      endMs: s.end_ms,
      kn: s.text_kn,
      en: s.text_en,
    })),
    parts: ((row.data?.parts as Array<Record<string, unknown>> | null) ?? []).map((p, n) => ({
      n,
      name: p.name,
      storable: p.storable,
      stored: p.stored,
    })),
  });
}

const PatchSchema = z.union([
  z.object({ storedPart: z.number().int().min(0) }),
  z.object({ consentStored: z.literal(true) }),
  z.object({ skipFailedChunks: z.literal(true) }),
  z.object({ retryFailedWindows: z.literal(true) }),
  z.object({ uploadTokens: z.literal(true) }),
]);

// Small state changes the page makes: an original part finished uploading; continue without
// chunks that failed three times; try failed extraction windows again; on resume, fresh upload
// tokens for original parts not stored yet (the first ones expire, and the consent note may be one).
export async function PATCH(req: Request, ctx: RouteContext<"/api/interviews/[id]">) {
  const c = await importContext();
  if (c instanceof Response) return c;
  const { id } = await ctx.params;
  const found = await interviewFor(c, id);
  if (found instanceof Response) return found;
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "invalid" }, 400);

  if ("storedPart" in body.data) {
    const { data } = await c.db.from("interviews").select("parts").eq("id", id).single();
    const parts = (data?.parts as Array<Record<string, unknown>> | null) ?? [];
    const n = body.data.storedPart;
    if (!parts[n]) return json({ error: "not_found" }, 404);
    // Trust but verify: the object must really be in storage before we say it is.
    const path = String(parts[n].path);
    const dir = path.slice(0, path.lastIndexOf("/"));
    const file = path.slice(path.lastIndexOf("/") + 1);
    const { data: listed } = await c.db.storage.from("interviews").list(dir, { search: file });
    if (!listed?.some((o) => o.name === file)) return json({ error: "not_uploaded" }, 409);
    parts[n] = { ...parts[n], stored: true };
    await c.db.from("interviews").update({ parts }).eq("id", id);
    // The consent line was at the start of this part: now that it is stored, consent is on record.
    if (await markConsentIfStored(c.db, found.interview.masterId, path)) revalidateOpenCards();
  } else if ("consentStored" in body.data) {
    const { data: m } = await c.db
      .from("masters")
      .select("consent_audio_path")
      .eq("id", found.interview.masterId)
      .maybeSingle();
    const ok = m?.consent_audio_path
      ? await markConsentIfStored(c.db, found.interview.masterId, String(m.consent_audio_path))
      : false;
    if (!ok) return json({ error: "not_uploaded" }, 409);
    revalidateOpenCards();
  } else if ("uploadTokens" in body.data) {
    const { data } = await c.db.from("interviews").select("parts").eq("id", id).single();
    const parts = (data?.parts as Array<Record<string, unknown>> | null) ?? [];
    const bucket = c.db.storage.from("interviews");
    const uploads = await Promise.all(
      parts.map(async (p, n) => {
        if (!p.storable || p.stored) return null;
        const path = String(p.path);
        const { data: signed } = await bucket.createSignedUploadUrl(path, { upsert: true });
        return signed ? { part: n, path, token: signed.token } : null;
      }),
    );
    return json({ uploads });
  } else if ("skipFailedChunks" in body.data) {
    await c.db
      .from("audio_chunks")
      .update({ status: "silent", error: "skipped" })
      .eq("interview_id", id)
      .eq("status", "failed");
  } else {
    await c.db
      .from("jobs")
      .update({ status: "queued", attempts: 0, error: null })
      .eq("interview_id", id)
      .eq("status", "failed");
    await c.db.from("interviews").update({ status: "extracting", error: null }).eq("id", id);
  }
  return json({ ok: true });
}
