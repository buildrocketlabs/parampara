import type { AskAi } from "@/lib/ask/types";
import { answerQuestion } from "./roles/answerer";
import { judgeStep } from "./roles/grounding_judge";
import { rankCards } from "./roles/retriever";
import { checkSafety } from "./roles/safety";
import { readPhoto } from "./roles/photo_reader";
import { triageQuestion, type AskLang } from "./roles/triage";
import { nameEchoCheck } from "./safety/names";
import { findDisclosures, findTeacherCrisis, findUnsafe } from "./safety/patterns";
import type { Span } from "./span";
import { transcribeChunk } from "./speech/sarvam";

// The teacher's question roles in the shape lib/ask's pipeline injects (docs/AI.md §2 to §5).
// The pipeline owns prefiltering, the approved set, dropping uncited steps, parallel judging, the
// two supported steps rule, caching and storage; these own the model calls and their guardrails.

const SPEECH_LANG: Record<AskLang, string> = { kn: "kn-IN", en: "en-IN", hi: "hi-IN" };

/** A voice question is under 30 s, so one speech to text call. Pass `lang` to hear Hindi as Hindi. */
export async function transcribeQuestion(
  wav: Uint8Array,
  opts: { traceId?: string; lang?: AskLang },
): Promise<{ text: string; span: Span }> {
  const heard = await transcribeChunk(wav, { traceId: opts.traceId, languageCode: SPEECH_LANG[opts.lang ?? "kn"] });
  return { text: heard.text, span: heard.span };
}

export const askAi = {
  transcribe: (wav, opts) => transcribeQuestion(wav, opts),
  triage: (input) => triageQuestion(input),
  readPhoto: (input) => readPhoto(input),
  rank: (input) => rankCards(input),
  answer: (input) => answerQuestion(input),
  judge: (input) => judgeStep(input),
  safety: (input) => checkSafety(input),
  unsafePatterns: (text) => findUnsafe(text),
  nameEchoCheck: (question) => nameEchoCheck(question),
  disclosurePatterns: (text) => findDisclosures(text),
  crisisPatterns: (text) => findTeacherCrisis(text),
} satisfies AskAi;
