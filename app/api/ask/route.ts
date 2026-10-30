import { after } from "next/server";
import { lineSpeaker, warmSpend } from "@/ai";
import { readCaps } from "@/ai/budget";
import { storeAnswerVoice, VOICE_LANG_CODE } from "@/lib/answers/voice";
import { getActiveSession } from "@/lib/auth/session";
import { askAi, askVersionTag } from "@/lib/ask/deps";
import { questionsPerHourFor, rawKeyHasher } from "@/lib/ask/limits";
import { ask } from "@/lib/ask/pipeline";
import { parseAskRequest } from "@/lib/ask/parse-request";
import { createAskStore, questionsLastHour } from "@/lib/ask/store";
import type { AnswerLang, AskStage, AskVoice, Outcome, PhotoReading } from "@/lib/ask/types";
import { hasSarvam, isFixtureMode } from "@/lib/env";
import { json } from "@/lib/import/http";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";

// A teacher's question → a grounded answer, streamed as honest stages (docs/AI.md §4):
// one JSON object per line: {"stage":"understanding"} … then {"outcome":{…}}.
// Voice questions arrive as a 16 kHz WAV under 30 s (lib/audio); the audio is never stored.
// "Show me" (M5.3): an optional JPEG of children's work, as multipart or base64 JSON, at most
// 1.5 MB. It is checked, stripped of every metadata segment, read once and never stored; the
// stream then carries {"photo":{…}} with what the work shows, before the answer.
// Role budgets total about 57 s plus speech and storage, so leave headroom (audit, M3).
export const maxDuration = 90;
/** Photos cost a vision call each: at most this many questions an hour when one comes with a photo. */
const PHOTO_QUESTIONS_PER_HOUR = 10;
/** One photo read at a time per teacher on this instance (parallel requests, audit M4). */
const photoInFlight = new Map<string, number>();
/** A lock older than the route's own limit is stale, whatever happened to its request. */
const PHOTO_LOCK_MS = 95_000;

const ndjson = {
  "content-type": "application/x-ndjson; charset=utf-8",
  "cache-control": "no-store",
};

function streamOf(run: (send: (obj: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // If she has gone (a dropped network), the work still finishes and its rows are written: a
      // paid model call always leaves its question behind, so the hourly cap counts it (audit A).
      let open = true;
      const send = (obj: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await run(send);
      } catch {
        // Never a raw error: the page shows Hanate caring, keeps the question, offers text.
        send({ error: "failed" });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      }
    },
  });
  return new Response(stream, { headers: ndjson });
}

const photoMessage = (r: PhotoReading, sample = false) => ({
  photo: {
    seenKn: r.seenKn,
    seenEn: r.seenEn,
    used: r.relevant && !r.faces,
    faces: r.faces,
    ...(sample ? { sample: true } : {}),
  },
});

/**
 * Fixture mode (no keys, no database): a scripted reader so "Show me" can be seen and tested.
 * `x-pp-fixture-photo: faces | unrelated` picks the other two paths. Nothing is answered here.
 */
function fixturePhoto(req: Request, sample: boolean): Response {
  const mode = req.headers.get("x-pp-fixture-photo") ?? (sample ? "sample-slate" : null);
  const reading: PhotoReading =
    mode === "faces"
      ? {
          seenKn: "ಫೋಟೋದಲ್ಲಿ ಒಬ್ಬ ವ್ಯಕ್ತಿ ಕಾಣುತ್ತಾರೆ, ಆದ್ದರಿಂದ ಅದನ್ನು ಬಳಸಲಿಲ್ಲ.",
          seenEn: "The photo shows a person, so it was not used.",
          relevant: false,
          faces: true,
          welfareConcern: false,
          problemHint: null,
        }
      : mode === "sample-slate"
        ? {
            // What a reader should say about our drawn slate (public/samples/slate-sample.svg).
            seenKn:
              "ನಾಲ್ಕು ಪದಗಳಲ್ಲಿ ಎರಡರಲ್ಲಿ ಬ ಮತ್ತು ವ ಅದಲು ಬದಲಾಗಿವೆ; 12 ಅನ್ನು 21 ಎಂದು, 15 ಅನ್ನು 51 ಎಂದು ಬರೆದಿದೆ.",
            seenEn: "ಬ and ವ are swapped in 2 of 4 words, and 12 and 15 are written as 21 and 51.",
            relevant: true,
            faces: false,
            welfareConcern: false,
            problemHint: "letter swap ಬ/ವ; reversed teen numbers",
          }
        : mode === "unrelated"
          ? {
              seenKn: "ಫೋಟೋದಲ್ಲಿ ಮಕ್ಕಳ ಬರವಣಿಗೆ ಕಾಣುವುದಿಲ್ಲ.",
              seenEn: "The photo does not show children's work.",
              relevant: false,
              faces: false,
              welfareConcern: false,
              problemHint: null,
            }
          : {
              seenKn: "ಆರು ಪದಗಳಲ್ಲಿ ನಾಲ್ಕರಲ್ಲಿ ಬ ಮತ್ತು ದ ಅಕ್ಷರಗಳು ಅದಲು ಬದಲಾಗಿವೆ.",
              seenEn: "Letters ಬ and ದ are swapped in 4 of 6 words.",
              relevant: true,
              faces: false,
              welfareConcern: false,
              problemHint: "letter swap ಬ/ದ",
            };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return streamOf(async (send) => {
    send({ stage: "seeing" satisfies AskStage });
    await wait(600);
    send(photoMessage(reading, true));
    if (reading.faces) {
      send({ outcome: { kind: "photo_refused", reason: "faces" } satisfies Outcome });
      return;
    }
    // Without keys there is no answer to give: the stages move on, then say so honestly.
    send({ stage: "understanding" satisfies AskStage });
    await wait(2_500);
    send({ error: "not_configured" });
  });
}

export async function POST(req: Request) {
  const session = await getActiveSession();
  if (!session) return json({ error: "sign_in_needed" }, 401);
  // Teachers ask; the other roles review, record or read aggregates (audit, 24 Oct).
  if (session.role !== "teacher") return json({ error: "teachers_only" }, 403);

  const parsed = await parseAskRequest(req, session.lang);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status);
  const { text, wav, lang, photo, photoSample } = parsed;

  const db = createAdminClient();
  if (!db)
    return photo && isFixtureMode()
      ? fixturePhoto(req, photoSample === true)
      : json({ error: "not_configured" }, 503);
  const ai = askAi();
  if (!ai) return json({ error: "ai_not_ready" }, 503);

  const caps = readCaps();
  const perHour = questionsPerHourFor(session.isSample, caps.questionsPerSessionPerHour);
  const cap = photo ? Math.min(perHour, PHOTO_QUESTIONS_PER_HOUR) : perHour;
  if ((await questionsLastHour(db, session.userId)) >= cap) {
    const limited: Outcome = { kind: "limited", retryInMinutes: 60 };
    return json({ outcome: limited });
  }
  if (photo) {
    const held = photoInFlight.get(session.userId);
    if (held !== undefined && Date.now() - held < PHOTO_LOCK_MS)
      return json({ error: "photo_busy" }, 429);
    photoInFlight.set(session.userId, Date.now());
  }

  const store = createAskStore(db);
  const traceId = crypto.randomUUID();
  const voice = answerVoice(db, lang, traceId);
  // The voice is finished after the text has gone (D86): the function stays up until it is kept.
  let settle: (work?: Promise<void>) => void = () => {};
  const settled = new Promise<void>((resolve) => {
    settle = (work) => void (work ?? Promise.resolve()).finally(resolve);
  });
  after(() => settled);
  return streamOf(async (send) => {
    try {
      const outcome = await ask(
        ai,
        store,
        {
          text,
          wav,
          lang,
          photo,
          teacherId: session.userId,
          isSample: session.isSample,
          traceId,
          versionTag: askVersionTag(),
          rawKey: rawKeyHasher(process.env.SUPABASE_SERVICE_ROLE_KEY),
          voice: voice?.hooks,
        },
        (stage: AskStage) => send({ stage }),
        (reading) => send(photoMessage(reading)),
      );
      send({ outcome });
    } finally {
      if (photo) photoInFlight.delete(session.userId);
      settle(voice?.work());
    }
  });
}

/**
 * The answer's voice, made while the text is checked (D86): lines start as they become final, and
 * once the answer is stored the joined file is kept on it, so the answer page finds it ready.
 * Without a speech key, or when speech fails, the answer page makes it on first play as before.
 */
function answerVoice(
  db: AdminClient,
  lang: AnswerLang,
  traceId: string,
): { hooks: AskVoice; work: () => Promise<void> | undefined } | null {
  if (!hasSarvam()) return null;
  let speaker: ReturnType<typeof lineSpeaker>;
  try {
    speaker = lineSpeaker({ codec: "mp3", languageCode: VOICE_LANG_CODE[lang], traceId });
  } catch {
    return null;
  }
  let work: Promise<void> | undefined;
  return {
    hooks: {
      start: (line) => speaker.start(line),
      finish: (answerId, lines) => {
        work = speaker
          .build(lines)
          .then((v) => storeAnswerVoice(db, answerId, v.audio, v.mime))
          .then(() => undefined)
          .catch(() => {
            console.warn("[ask] the answer's voice was not made ahead; it is made on first play");
          });
      },
    },
    work: () => work,
  };
}

/**
 * A warm up the ask screen sends when it opens (Track B): no model call and nothing stored. It
 * wakes this function and its database connection, and reads the spend total into memory, so the
 * first question does not wait for any of them.
 */
export async function GET() {
  const session = await getActiveSession();
  if (!session || session.role !== "teacher")
    return json({ warm: false }, 200, { "cache-control": "no-store" });
  const db = createAdminClient();
  if (!db) return json({ warm: false }, 200, { "cache-control": "no-store" });
  const started = Date.now();
  const store = createAskStore(db);
  const pool = session.isSample ? "all" : "field";
  await Promise.allSettled([warmSpend(), store.libraryVersion(pool), store.cardIndex(pool)]);
  return json({ warm: true, ms: Date.now() - started }, 200, { "cache-control": "no-store" });
}
