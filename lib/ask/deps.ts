import {
  ANSWERER_PROMPT_VERSION,
  askAi as roles,
  JUDGE_PROMPT_VERSION,
  RETRIEVER_PROMPT_VERSION,
  SAFETY_PATTERNS_VERSION,
  SAFETY_PROMPT_VERSION,
  TRIAGE_PROMPT_VERSION,
} from "@/ai";
import { modelIdFor } from "@/ai/router";
import type { AskAi } from "./types";

// Wires the teacher question pipeline to the AI roles in @/ai (Law 3). Without keys the roles answer
// honestly: speech throws SpeechNotConfigured, Claude roles replay recordings or return needs_human.
export function askAi(): AskAi | null {
  return roles;
}

/** Part of the answer cache key: any prompt or pattern change is a cache miss (D35). */
export function askVersionTag(): string {
  return [
    TRIAGE_PROMPT_VERSION,
    RETRIEVER_PROMPT_VERSION,
    ANSWERER_PROMPT_VERSION,
    JUDGE_PROMPT_VERSION,
    SAFETY_PROMPT_VERSION,
    SAFETY_PATTERNS_VERSION,
    modelIdFor("triage"),
    modelIdFor("retriever"),
    modelIdFor("answerer"),
    modelIdFor("grounding_judge"),
    modelIdFor("safety"),
  ].join("|");
}
