import { importContext, json } from "@/lib/import/http";
import { createMaster, listMasters, NewMasterSchema } from "@/lib/masters/store";

// Masters a reviewer can import for (or the master themselves). POST adds a master on their behalf.
export async function GET() {
  const ctx = await importContext();
  if (ctx instanceof Response) return ctx;
  return json({ masters: await listMasters(ctx.db, ctx.session) });
}

export async function POST(request: Request) {
  const ctx = await importContext();
  if (ctx instanceof Response) return ctx;
  if (ctx.session.role !== "reviewer") return json({ error: "not_allowed" }, 403);
  const parsed = NewMasterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return json(
      { error: "invalid", fields: parsed.error.issues.map((i) => i.path.join(".")) },
      400,
    );
  const id = await createMaster(ctx.db, ctx.session, parsed.data);
  return json({ masterId: id }, 201);
}
