import { captureAi } from "@/ai";
import type { ImportAi } from "./types";

// Wires the import pipeline to the AI roles in @/ai (Law 3). Without keys the roles answer honestly:
// speech throws SpeechNotConfigured, Claude roles replay recordings or return needs_human.
export function importAi(): ImportAi | null {
  return captureAi;
}
