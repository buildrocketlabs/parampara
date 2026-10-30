import { z } from "zod";
import {
  InterviewTopic,
  MAX_PROBES_PER_TOPIC,
  NAME_REMINDER,
  SESSION_CLOSE_BY_MS,
  type InterviewTopic as Topic,
} from "@/lib/domain/interview";
import {
  INTERVIEWER_PROMPT_VERSION,
  INTERVIEWER_SYSTEM_V2,
  renderInterviewerPrompt,
} from "../prompts/interviewer";
import { modelIdFor } from "../router";
import { runStructured, type NeedsHumanReason, type RunDeps } from "../run";
import { hasChildNamePattern } from "../safety/names";
import { scanUnsafe } from "../safety/patterns";
import type { Span } from "../span";
import { kannadaLetters, latinLetters, tidyEn } from "../text";

// Interviewer (Sonnet, interviewer@v1). The redacted conversation so far in, Hanate's next question
// out (docs/AI.md §2). The master is waiting, so it is fast or it hands back to the scripted guide.

export const InterviewerOutput = z.object({
  questionKn: z.string().min(1).max(500),
  questionEn: z.string().min(1).max(400),
  why: z.string().max(300),
  topic: InterviewTopic,
  probe: z.boolean(),
  done: z.boolean(),
});
export type InterviewerOutput = z.infer<typeof InterviewerOutput>;

export type InterviewTurn = { topic: Topic; probe: boolean };

export type InterviewerInput = {
  master: { name: string | null; years: number | null; classes: string | null };
  /** Redacted, speaker tagged, in order. Hanate's own questions are speaker "interviewer". */
  transcript: Array<{ speaker: string | null; textKn: string; textEn: string | null }>;
  /** The questions asked so far, in order. */
  turns: InterviewTurn[];
  /** Titles of cards already captured from this master, so topics are not asked twice. */
  cardsCaptured: string[];
  elapsedMs: number;
  /** The redactor replaced a child's name in the last answer: begin with the gentle reminder. */
  lastAnswerHadName: boolean;
  traceId?: string;
  itemId?: string;
};

export type NextQuestion = {
  questionKn: string;
  questionEn: string;
  why: string;
  topic: Topic;
  probe: boolean;
  done: boolean;
};

export type InterviewerResult =
  | { status: "ok"; question: NextQuestion; attempts: number; replayed: boolean; span: Span }
  | { status: "needs_human"; reason: NeedsHumanReason; problems: string[]; span: Span };

/** A master waits for the next question: keep it short, retry only a fast failure. */
export const INTERVIEWER_TIME_BUDGET_MS = 20_000;

// ── Deterministic rules from the interview guide and the M4 safety audit (24 Oct) ─────────────
// Kannada is matched on word stems (suffixes vary, and \b does not know Kannada script). Each rule
// runs over both strings, since a question can be code mixed. The guide's own lines all pass
// (lib/talk/script.test.ts), and so does every eval reference.

/** A person the question could be asking to identify: a child, a family member, or "them". */
const PERSON_EN =
  "(?:child|children|boy|boys|girl|girls|student|students|pupil|pupils|kid|kids|son|daughter|his|her|their|him|them|he|she|father|mother|parent|parents|dad|mum|mom|family|brother|sister|uncle|aunt)";
const PERSON_KN =
  "(?:ಮಗು|ಮಗುವ|ಮಗೂ|ಮಕ್ಕಳ|ಹುಡುಗ|ಹುಡುಗಿ|ಅವನ|ಅವಳ|ಅವರ|ಅವ್ರ|ಅವ್ನ|ಅವ್ಳ|ವಿದ್ಯಾರ್ಥಿ|ತಂದೆ|ತಾಯಿ|ಅಪ್ಪ|ಅಮ್ಮ|ಪೋಷಕ|ಅಣ್ಣ|ಅಕ್ಕ|ತಂಗಿ|ಮಾವ|ಚಿಕ್ಕಪ್ಪ|child|boy|girl|student|kid|father|mother)";

/** "No need for the child's name", ಹೆಸರು ಬೇಡ: the reminder itself, not an ask. */
const NAME_NEGATED_BEFORE_EN =
  /\b(?:no need for|no need to (?:say|use|give|tell me|share)|don['’]?t need|do not need|(?:let us|let['’]s|we will|we['’]ll|please) not (?:use|say|mention|share)|(?<!(?:don['’]?t|do not|not|never)\s)leave out|without(?: using| saying| naming)?|never (?:say|use|mention)|no|not|instead of|rather than)\s+(?:(?:the|a|any|his|her|their|that)\s+)?$/iu;
/**
 * Right after ಹೆಸರ, within one more word, a whole word that says "not needed" or "do not say" ends
 * the clause: ಹೆಸರು ಬೇಡ, ಹೆಸರು ಹೇಳುವ ಅಗತ್ಯವಿಲ್ಲ, ಹೆಸರು ಹೇಳಬೇಡಿ. Never a negator inside another word,
 * so ಹೆಸರು ಹೇಳಲು ಹಿಂಜರಿಯಬೇಡಿ ("don't hesitate to say the name") stays an ask (safety audit, 24 Oct).
 */
const NAME_NEGATOR_KN =
  /^\S*\s+(?:\S+\s+)?(?:ಬೇಡ|ಬೇಡಿ|ಬೇಕಿಲ್ಲ|ಬೇಕಾಗಿಲ್ಲ|ಅಗತ್ಯವಿಲ್ಲ|ಅವಶ್ಯಕತೆ\s+ಇಲ್ಲ|ಹೇಳಬೇಡಿ|ಹೇಳಬೇಡ|ಬಳಸಬೇಡಿ|ಬಳಸಬೇಡ)\s*(?:$|[,.;।])/u;
const ASK_VERB_KN = /(?:^|\s)(?:ಹೇಳಿ|ತಿಳಿಸಿ|ಹೇಳ್ತೀರಾ|ಹೇಳುತ್ತೀರಾ|ಏನು|ಏನೆಂದು|ಯಾರು)(?=$|[\s,.?!।])/u;

function negatedAfterKn(rest: string): boolean {
  const sentence = rest.split(/[.?!।\n]/u)[0] ?? "";
  return NAME_NEGATOR_KN.test(rest) && !ASK_VERB_KN.test(sentence);
}

const NAME_ASK_EN: RegExp[] = [
  new RegExp(`\\b${PERSON_EN}(?:['’]s|s['’])?\\b[^.!?;]{0,30}?\\bnames?\\b`, "giu"),
  new RegExp(`\\bnames?\\s+(?:of|for)\\s+(?:the\\s+|that\\s+|this\\s+|those\\s+|these\\s+|your\\s+)?${PERSON_EN}\\b`, "giu"),
  /\b(?:spell|surname|full\s+name|first\s+name|last\s+name|real\s+name)\b/giu,
  new RegExp(`\\bwhat\\s+(?:did|do|would)\\s+(?:you|they|people|the others)\\s+call\\s+(?:him|her|them|the\\s+(?:child|boy|girl|student|kid))\\b`, "giu"),
  /\bwhat\s+(?:was|is)\s+(?:he|she|the child|the boy|the girl)\s+called\b/giu,
  /\b(?:nick\s*names?|roll\s+numbers?|register\s+numbers?)\b/giu,
  /\bwho\s+(?:was|is)\s+(?:that|this|the)\s+(?:child|boy|girl|student|kid)\b/giu,
];
const OTHER_ID_ASK_KN = /ಅಡ್ಡ\s*ಹೆಸರ|ರೋಲ್\s*ನಂಬರ್|ಹಾಜರಾತಿ\s*ಸಂಖ್ಯೆ|(?:ಮಗು|ಹುಡುಗ|ಹುಡುಗಿ)\s+ಯಾರು/u;
const NAME_ASK_KN = new RegExp(`${PERSON_KN}[^.!?।]{0,25}?ಹೆಸರ`, "gu");
const CALL_ASK_KN = new RegExp(`${PERSON_KN}\\S*\\s*(?:ಏನೆಂದು|ಏನಂತ|ಏನು\\s*ಅಂತ|ಏನಂತಾ)\\s*ಕರೆ`, "u");

function asksName(text: string): boolean {
  for (const re of NAME_ASK_EN) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      if (!NAME_NEGATED_BEFORE_EN.test(text.slice(Math.max(0, m.index - 40), m.index))) return true;
    }
  }
  NAME_ASK_KN.lastIndex = 0;
  for (const m of text.matchAll(NAME_ASK_KN)) {
    if (!negatedAfterKn(text.slice(m.index + m[0].length))) return true;
  }
  return CALL_ASK_KN.test(text) || OTHER_ID_ASK_KN.test(text);
}

// A child's caste, religion, village, family or the parents' work, which together point to one child.
const IDENTITY_ALWAYS =
  /ಜಾತಿ|ಧರ್ಮ|ಯಾವ\s*ಸಮುದಾಯ|\bcastes?\b|\breligio(?:n|ns|us)\b|\bjati\b|\bwhich\s+community\b|\bcommunity\s+(?:was|were|is|are)\s+(?:they|the|that)\b/iu;
const IDENTITY_OF_A_CHILD =
  /ಯಾವ\s*ಊರ|ಯಾವ\s*ಹಳ್ಳಿ|ಯಾವ\s*ತಾಂಡ|\bwhere\s+(?:was|were|is|are|did)\s+(?:he|she|they|the\s+(?:child|boy|girl|family))\s+(?:from|live|stay)\b|ಯಾರ\s*ಮನೆ|ಯಾವ\s*ಕೇರಿ|ಯಾವ\s*ಓಣಿ|ಯಾವ\s*ಮನೆತನ|(?:ತಂದೆ|ತಾಯಿ|ಅಪ್ಪ|ಅಮ್ಮ|ಪೋಷಕ)\S*\s*(?:ಏನು|ಯಾವ)\s*ಕೆಲಸ|\bwhich\s+(?:village|street|colony|family|house|caste)\b|\bwhose\s+(?:family|house|son|daughter|child)\b|\b(?:father|mother|parents?|dad|mum|mom)(?:['’]s)?\s+(?:job|work|occupation)\b|\bwhat\s+did\s+(?:his|her|their|the)\s+(?:father|mother|parents?|dad|mum|mom)\s+do\b/iu;
const MENTIONS_PERSON = new RegExp(`${PERSON_KN}|\\b${PERSON_EN}\\b`, "iu");

function asksIdentity(text: string): boolean {
  return IDENTITY_ALWAYS.test(text) || (IDENTITY_OF_A_CHILD.test(text) && MENTIONS_PERSON.test(text));
}

// Probing a punishment or fear in plain or colloquial words, beyond the shared patterns (a master's
// story of caning is thanked and left, never explored). ಬಾರಿಸು also rings a bell, so only with a child.
const HARM_PROBE: RegExp[] = [
  /ತದುಕ/u,
  /(?:ಮಗು|ಮಗುವ|ಮಕ್ಕಳ|ಹುಡುಗ|ಹುಡುಗಿ|ಅವನ|ಅವಳ|ಅವರನ್ನ|ಅವ್ನ|ಅವ್ಳ)\S*\s+(?:(?!ಗಂಟೆ|ಬೆಲ್|ಡೋಲು|ತಮಟೆ|ಡಂಗುರ|ಚಪ್ಪಾಳೆ|ಸೀಟಿ|ಸಿಳ್ಳೆ|ತಬಲ)\S+\s+){0,2}ಬಾರಿಸ/u,
  /ಹೆದರುವಂತೆ|ಹೆದರೋ\s*ಹಾಗೆ|ಹೆದರುವ\s*ಹಾಗೆ|ಭಯ\s*(?:ಹುಟ್ಟಿಸ|ಪಡಿಸ|ಬೀಳಿಸ)|ಭಯಪಡಿಸ/u,
  /ಮಾತು\s*ಕೇಳ(?:ೋ|ುವ)\s*(?:ಹಾಗೆ|ಹಂಗೆ|ರೀತಿ)|ಮಾತು\s*ಕೇಳುವಂತೆ|ಮಾತು\s*ಕೇಳೋಹಾಗೆ/u,
  /\bobe(?:y|yed|ying|dience|dient)\b|\bmake\b[^.?!]{0,30}\b(?:fearful|afraid|scared|fear)\b/iu,
];

// Leading: a yes or no question that names a method, a tag question, or a word that pushes an answer.
const LEADING: RegExp[] = [
  /(?:^|[.;:!]\s+)(?:did|do|have|had|would|could|didn['’]?t|don['’]?t|wouldn['’]?t)\s+you\s+(?:ever\s+)?(?:use|try|give|make|bring|play|sing|show)\b/iu,
  /,\s*(?:didn['’]?t|don['’]?t|wasn['’]?t|isn['’]?t|weren['’]?t|aren['’]?t|wouldn['’]?t|couldn['’]?t|hasn['’]?t|haven['’]?t)\s+(?:it|they|you|he|she|we|that|there)\s*\??\s*$/iu,
  /\b(?:surely|obviously|of course)\b/iu,
  /(?:ಅಲ್ವಾ|ಅಲ್ವೇ|ಅಲ್ಲವೇ|ಅಲ್ಲವಾ|ಅಲ್ಲವೆ|ಅಲ್ಲ್ವಾ|ತಾನೇ|ತಾನೆ)\s*\??\s*$/u,
  /,\s*right\s*\?\s*$/iu,
  /(?:ಬಳಸ|ಉಪಯೋಗಿಸ|ಹಾಡಿಸ|ತೋರಿಸ|ಕೊಟ್ಟ)\S*ರಾ\s*\?/u,
];

// Off the interview's subject: contact details, ID or account numbers, links, medicine. A master is
// never asked these, and the server signs and says aloud whatever passes here (lib/talk/sign).
const OFF_DOMAIN: RegExp[] = [
  /\d[\d\s-]{5,}\d/u,
  /https?:\/\/|www\.|\.(?:com|in|org|net)\b|\S+@\S+/iu,
  /\b(?:aadhaa?r|pan\s+card|account\s+numbers?|passwords?|otp|phone\s+numbers?|mobile\s+numbers?|e-?mail|(?:home|house|postal)\s+address|address\s+of)\b/iu,
  /ಆಧಾರ್|ವಿಳಾಸ|ಫೋನ್\s*ನಂಬರ್|ಮೊಬೈಲ್\s*ನಂಬರ್|ಪಾಸ್\S*ವರ್ಡ್|ಒಟಿಪಿ/u,
  /\b(?:medicines?|paracetamol|dose|dosage|injections?|drugs?)\b|ಮಾತ್ರೆ|ಔಷಧ|ಇಂಜೆಕ್ಷನ್/iu,
];

type Ctx = Pick<InterviewerInput, "turns" | "elapsedMs" | "lastAnswerHadName">;

function trailingProbes(turns: InterviewTurn[], topic: Topic): number {
  let n = 0;
  for (let i = turns.length - 1; i >= 0 && turns[i]!.topic === topic && turns[i]!.probe; i--) n++;
  return n;
}

/** Deterministic checks of the guide's rules; each message goes back to the model on retry. */
export function validateInterviewer(ctx: Ctx, out: InterviewerOutput): string[] {
  const problems: string[] = [];
  const last = ctx.turns[ctx.turns.length - 1];
  const closeAsked = ctx.turns.some((t) => t.topic === "close");

  // The guide's own reminder ("no need for the child's name") is never read as a question about one.
  const kn = out.questionKn.replace(NAME_REMINDER.kn, " ");
  const en = out.questionEn.replace(NAME_REMINDER.en, " ");
  const both = `${kn}\n${en}`;
  if (kannadaLetters(out.questionKn) === 0) problems.push("questionKn must be in Kannada script.");
  if (kannadaLetters(out.questionEn) > latinLetters(out.questionEn)) problems.push("questionEn must be in English.");
  if (!out.done && ((out.questionEn.match(/\?/g)?.length ?? 0) > 1 || (out.questionKn.match(/\?/g)?.length ?? 0) > 1)) {
    problems.push("Ask one question at a time.");
  }
  if (asksName(kn) || asksName(en)) problems.push("Never ask for a child's name, or anyone's.");
  if (hasChildNamePattern(both)) problems.push("Never put a child's name in the question.");
  if (asksIdentity(kn) || asksIdentity(en)) {
    problems.push("Never ask a child's caste, religion, village, family or the parents' work.");
  }
  // Any mention of hitting, scaring or shaming, even "why did you not cane", dwells on it.
  if (scanUnsafe(both).length > 0 || HARM_PROBE.some((re) => re.test(both))) {
    problems.push("Do not ask about hitting, scaring, shaming or labelling a child. Ask what the master did instead, or move on.");
  }
  if (OFF_DOMAIN.some((re) => re.test(both))) {
    problems.push("Ask only about the master's teaching: never contact details, numbers, links or medicine.");
  }
  if (LEADING.some((re) => re.test(out.questionKn) || re.test(out.questionEn))) {
    problems.push("Do not lead: ask an open question, without suggesting a method, a material or an answer.");
  }
  if (ctx.lastAnswerHadName && !out.questionKn.includes("ಒಂದು ಮಗು")) {
    problems.push("The last answer named a child: begin with the gentle reminder to call the child ಒಂದು ಮಗು.");
  }
  if (out.probe) {
    if (!last) problems.push("The first question cannot be a probe.");
    else if (last.topic !== out.topic) problems.push(`A probe continues the current topic (${last.topic}).`);
    else if (trailingProbes(ctx.turns, out.topic) >= MAX_PROBES_PER_TOPIC) {
      problems.push("Three follow ups on this topic already. Move to the next topic.");
    }
  } else if (out.topic !== "close" && ctx.turns.some((t) => t.topic === out.topic && !t.probe)) {
    problems.push(`The ${out.topic} topic was already opened. Probe it or move to another topic.`);
  }
  if (out.done) {
    if (!closeAsked) problems.push("Ask the closing question (topic close) before ending.");
    if (out.topic !== "close") problems.push("When done, the topic is close.");
  } else {
    if (last?.topic === "close") problems.push("The closing question has been answered: set done to true and thank the master.");
    if (ctx.elapsedMs >= SESSION_CLOSE_BY_MS && out.topic !== "close") {
      problems.push("The session is at its time: ask the closing question now (topic close).");
    }
  }
  return problems;
}

function tidyQuestion(out: InterviewerOutput): NextQuestion {
  return {
    questionKn: out.questionKn.trim(),
    questionEn: tidyEn(out.questionEn),
    why: tidyEn(out.why),
    topic: out.topic,
    probe: out.probe,
    done: out.done,
  };
}

export function buildInterviewerRequest(input: Omit<InterviewerInput, "traceId" | "itemId">) {
  return {
    system: INTERVIEWER_SYSTEM_V2,
    prompt: renderInterviewerPrompt({
      master: input.master,
      transcript: input.transcript.map((s) => ({ speaker: s.speaker, text: s.textKn })),
      turns: input.turns,
      cardsCaptured: input.cardsCaptured,
      elapsedMs: input.elapsedMs,
      lastAnswerHadName: input.lastAnswerHadName,
    }),
  };
}

export async function nextInterviewQuestion(input: InterviewerInput, deps?: RunDeps): Promise<InterviewerResult> {
  const { system, prompt } = buildInterviewerRequest(input);
  const res = await runStructured(
    {
      role: "interviewer",
      promptVersion: INTERVIEWER_PROMPT_VERSION,
      system,
      prompt,
      schema: InterviewerOutput,
      traceId: input.traceId,
      itemId: input.itemId,
      timeBudgetMs: INTERVIEWER_TIME_BUDGET_MS,
      minRetryMs: 6_000,
      validate: (out) => validateInterviewer(input, out),
    },
    deps,
  );
  if (res.status !== "ok") return { status: "needs_human", reason: res.reason, problems: res.problems, span: res.span };
  return { status: "ok", question: tidyQuestion(res.output), attempts: res.attempts, replayed: res.replayed, span: res.span };
}

export const interviewerRole = {
  id: "interviewer",
  model: modelIdFor("interviewer"),
  promptVersion: INTERVIEWER_PROMPT_VERSION,
  schema: InterviewerOutput,
  run: nextInterviewQuestion,
} as const;
