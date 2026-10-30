import { originFromHeaders, shareBaseUrl } from "@/lib/app-url";
import { loadOpenCard } from "@/lib/open/load";
import type { ShareMeta } from "@/lib/share/card";

// GET /api/cards/[id]/share: the words of a Tomorrow card, for the Share button's message and for the
// card the browser draws in Kannada (lib/share/draw-card.ts). Public and
// cached like open data: only an approved card of a consented master, credited as they chose,
// with its Sample flag. The same source as /api/cards/[id]/image, so words and picture agree.
export async function GET(req: Request, ctx: RouteContext<"/api/cards/[id]/share">) {
  const { id } = await ctx.params;
  try {
    const card = await loadOpenCard(id);
    if (!card) {
      return Response.json(
        { error: "not_shared" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }
    const meta: ShareMeta = {
      id: card.id,
      title: card.title,
      credit: card.master.name,
      isSample: card.isSample,
      problem: card.problem,
      steps: card.steps,
      materials: card.materials,
      topic: card.topic,
      gradeBand: card.gradeBand,
      master: { years: card.master.yearsTeaching, district: card.master.district },
      host: shareBaseUrl(originFromHeaders(req.headers)).replace(/^https?:\/\//, ""),
    };
    return Response.json(meta, {
      headers: { "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=600" },
    });
  } catch {
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
