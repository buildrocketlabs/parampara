import { askAi } from "@/lib/ask/deps";

// Free text a person types (feedback; the same rule as tried notes and thank you words) goes
// through the question triage redactor before anything is stored (Law 5; safety audit, 24 Oct).
// Fail closed: when the redactor is unavailable or unsure, the words are not kept at all, and a
// child at risk found by triage becomes the helpline instead. Server only.
export async function redactFreeText(
  text: string | null,
  lang: "kn" | "en" | "hi",
): Promise<{ text: string | null; helpline: "childline" | null }> {
  if (!text?.trim()) return { text: null, helpline: null };
  const ai = askAi();
  if (!ai) return { text: null, helpline: null };
  const tri = await ai.triage({ text, lang, traceId: crypto.randomUUID() }).catch(() => null);
  if (!tri || tri.status !== "ok") return { text: null, helpline: null };
  const risk =
    tri.triage.intent === "safety_disclosure" ||
    tri.triage.safetyFlags.some((f) =>
      ["child_harm", "abuse", "child_marriage", "child_labour"].includes(f),
    );
  if (risk) return { text: null, helpline: "childline" };
  return { text: tri.triage.redactedText.trim() || null, helpline: null };
}
