import type { Session } from "@/lib/auth/session";
import { plainName } from "@/lib/auth/demo";
import type { ServerClient } from "@/lib/supabase/server";

// The master's room (docs/BUILD.md M4.2): what their wisdom did, the thanks that reached them, and
// their cards. Numbers come from master_impact() and master_card_impact() (0005): aggregates for
// the calling master only, null for "a few" (fewer than three teachers). Never a teacher's id.

export type MasterImpact = {
  approvedCards: number;
  /** null: a few (one or two teachers). */
  reached: number | null;
  tried: number | null;
  worked: number | null;
  thanks: number;
};

export type MasterCard = {
  id: string;
  title: { kn: string; en: string };
  tried: number | null;
  worked: number | null;
};

export type ThankYouNote = {
  id: string;
  text: string;
  /** An English rendering, when there is one (the Sample notes); a teacher's own words stay hers. */
  textEn?: string;
  createdAt: string;
  isNew: boolean;
  hasVoice: boolean;
};

export type MasterHomeData = {
  name: string | null;
  isSample: boolean;
  impact: MasterImpact | null;
  /** The numbers could not be read (for example before 0005 is applied): say so, never guess. */
  impactFailed: boolean;
  cards: MasterCard[];
  drafts: number;
  thanks: ThankYouNote[];
};

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

export async function getMasterHome(db: ServerClient, session: Session): Promise<MasterHomeData> {
  const name = plainName(session.displayName);
  const { data: me } = await db
    .from("masters")
    .select("id, is_sample")
    .eq("profile_id", session.userId)
    .maybeSingle();
  if (!me) {
    return {
      name,
      isSample: session.isSample,
      impact: null,
      impactFailed: false,
      cards: [],
      drafts: 0,
      thanks: [],
    };
  }

  const [impactRes, cardsRes, perCardRes, thanksRes] = await Promise.all([
    db.rpc("master_impact"),
    db
      .from("cards")
      .select("id, title_kn, title_en, status")
      .eq("master_id", me.id)
      .order("updated_at", { ascending: false }),
    db.rpc("master_card_impact"),
    db
      .from("thanks")
      .select("id, text, audio_path, delivered_at, created_at")
      .eq("master_id", me.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const row = (impactRes.data as Array<Record<string, unknown>> | null)?.[0];
  const impact: MasterImpact | null = row
    ? {
        approvedCards: num(row.approved_cards) ?? 0,
        reached: num(row.teachers_reached),
        tried: num(row.teachers_tried),
        worked: num(row.teachers_worked),
        thanks: num(row.thanks) ?? 0,
      }
    : null;

  const perCard = new Map(
    ((perCardRes.data as Array<Record<string, unknown>> | null) ?? []).map((r) => [
      r.card_id as string,
      { tried: num(r.teachers_tried), worked: num(r.teachers_worked) },
    ]),
  );
  const all = (cardsRes.data ?? []) as Array<{
    id: string;
    title_kn: string;
    title_en: string;
    status: string;
  }>;
  const cards = all
    .filter((c) => c.status === "approved")
    .map((c) => ({
      id: c.id,
      title: { kn: c.title_kn, en: c.title_en },
      // null is "a few" (one or two teachers): never shown as "not tried yet".
      tried: perCard.has(c.id) ? (perCard.get(c.id)?.tried ?? null) : 0,
      worked: perCard.has(c.id) ? (perCard.get(c.id)?.worked ?? null) : 0,
    }));
  const drafts = all.filter((c) => c.status === "draft").length;

  const thanks = ((thanksRes.data ?? []) as Array<Record<string, unknown>>)
    .filter((t) => typeof t.text === "string" && t.text)
    .map((t) => ({
      id: t.id as string,
      text: t.text as string,
      createdAt: t.created_at as string,
      isNew: t.delivered_at == null,
      hasVoice: Boolean(t.audio_path),
    }));

  return {
    name,
    isSample: Boolean(me.is_sample),
    impact,
    impactFailed: impact === null && impactRes.error !== null,
    cards,
    drafts,
    thanks,
  };
}

/** Fixture mode (no database yet): a labelled Sample room, so the screen can be seen and judged. */
export function sampleMasterHome(session: Session): MasterHomeData {
  const day = 24 * 60 * 60 * 1000;
  const base = Date.parse("2026-10-23T09:00:00.000Z");
  return {
    name: plainName(session.displayName),
    isSample: true,
    impact: { approvedCards: 3, reached: 14, tried: 12, worked: 9, thanks: 3 },
    impactFailed: false,
    cards: [
      {
        id: "sample-card-1",
        title: {
          kn: "ಹತ್ತರ ಕಟ್ಟು: ಕಡ್ಡಿಗಳಿಂದ ಸ್ಥಾನಬೆಲೆ",
          en: "Bundles of ten: place value with sticks",
        },
        tried: 12,
        worked: 9,
      },
      {
        id: "sample-card-2",
        title: { kn: "ನೆಲದ ಮೇಲೆ ಸಂಖ್ಯಾ ರೇಖೆ", en: "A number line on the floor" },
        tried: null,
        worked: null,
      },
      {
        id: "sample-card-3",
        title: { kn: "ಡಬ್ಬದಲ್ಲಿ ಅಕ್ಷರ ಕಾರ್ಡುಗಳು", en: "Letter cards in a tin" },
        tried: 0,
        worked: 0,
      },
    ],
    drafts: 1,
    thanks: [
      {
        id: "sample-thanks-1",
        text: "ನಿಮ್ಮ ಉಪಾಯ ನನ್ನ ತರಗತಿಯಲ್ಲಿ ಫಲ ಕೊಟ್ಟಿತು. ಧನ್ಯವಾದಗಳು.",
        textEn: "Your idea worked in my class. Thank you.",
        createdAt: new Date(base).toISOString(),
        isNew: true,
        hasVoice: false,
      },
      {
        id: "sample-thanks-2",
        text: "ಮಕ್ಕಳು ಖುಷಿಯಿಂದ ಕಲಿತರು. ನಿಮಗೆ ನಮನ.",
        textEn: "The children learned happily. My respects to you.",
        createdAt: new Date(base - 2 * day).toISOString(),
        isNew: false,
        hasVoice: false,
      },
      {
        id: "sample-thanks-3",
        text: "ನಿಮ್ಮ ಅನುಭವ ನನಗೆ ದಾರಿ ತೋರಿಸಿತು.",
        textEn: "Your experience showed me the way.",
        createdAt: new Date(base - 5 * day).toISOString(),
        isNew: false,
        hasVoice: false,
      },
    ],
  };
}
