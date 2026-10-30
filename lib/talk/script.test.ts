import { describe, expect, it } from "vitest";
import { validateInterviewer } from "@/ai/roles/interviewer";
import { isScriptedLine, isScriptedQuestion, scriptedNext, type Turn } from "./script";

const run = (n: number) => {
  const turns: Turn[] = [];
  const asked = [];
  for (let i = 0; i < n; i++) {
    const q = scriptedNext({ turns, elapsedMs: i * 60_000 });
    asked.push(q);
    if (q.done) break;
    turns.push({ topic: q.topic, probe: q.probe });
  }
  return { asked, turns };
};

describe("scripted interviewer", () => {
  it("opens with the warm up, probes each topic twice, then moves on through the guide", () => {
    const { asked } = run(8);
    expect(asked.map((q) => `${q.topic}${q.probe ? "+" : ""}`)).toEqual([
      "warmup",
      "letters",
      "letters+",
      "letters+",
      "reading",
      "reading+",
      "reading+",
      "number_sense",
    ]);
  });

  it("closes with the signature line and then thanks the master", () => {
    const { asked } = run(40);
    const last = asked[asked.length - 1]!;
    expect(last.done).toBe(true);
    expect(asked[asked.length - 2]!.topic).toBe("close");
  });

  it("closes at the session's time, whatever is left", () => {
    const q = scriptedNext({ turns: [{ topic: "warmup", probe: false }, { topic: "letters", probe: false }], elapsedMs: 39 * 60_000 });
    expect(q.topic).toBe("close");
  });

  it("starts with the gentle reminder when a child was named", () => {
    const q = scriptedNext({ turns: [{ topic: "letters", probe: false }], elapsedMs: 0, lastAnswerHadName: true });
    expect(q.questionKn).toContain("ಒಂದು ಮಗು");
  });

  it("every scripted question passes the interviewer's own rules", () => {
    const turns: Turn[] = [];
    for (let i = 0; i < 40; i++) {
      const q = scriptedNext({ turns, elapsedMs: i * 60_000 });
      expect(validateInterviewer({ turns, elapsedMs: i * 60_000, lastAnswerHadName: false }, q)).toEqual([]);
      if (q.done) break;
      turns.push({ topic: q.topic, probe: q.probe });
    }
  });

  it("after a child in danger or the master's despair: thanks, no follow up on it, the next topic", () => {
    const turns: Turn[] = [{ topic: "warmup", probe: false }, { topic: "letters", probe: false }];
    for (const care of ["child", "self", "both"] as const) {
      const q = scriptedNext({ turns, elapsedMs: 600_000, care });
      expect(q.probe).toBe(false);
      expect(q.topic).toBe("reading");
      expect(q.questionKn).toContain("ಧನ್ಯವಾದ");
      expect(validateInterviewer({ turns, elapsedMs: 600_000, lastAnswerHadName: false }, q)).toEqual([]);
      expect(isScriptedQuestion({ kn: q.questionKn, en: q.questionEn, topic: q.topic, probe: q.probe })).toBe(true);
    }
  });

  it("knows its own lines, and nothing else", () => {
    const q = scriptedNext({ turns: [{ topic: "letters", probe: false }], elapsedMs: 0, lastAnswerHadName: true });
    expect(isScriptedQuestion({ kn: q.questionKn, en: q.questionEn, topic: q.topic, probe: q.probe })).toBe(true);
    expect(isScriptedQuestion({ kn: "ಆ ಮಗುವಿನ ಹೆಸರೇನು?", en: q.questionEn, topic: q.topic, probe: q.probe })).toBe(false);
    expect(isScriptedLine(q.questionKn)).toBe(true);
    expect(isScriptedLine("ಯಾವುದೇ ಬೇರೆ ಮಾತು")).toBe(false);
  });

  it("closes once the session's question bound is near", () => {
    const turns: Turn[] = Array.from({ length: 59 }, (_, i) => ({ topic: i % 2 ? "letters" : "reading", probe: true }));
    expect(scriptedNext({ turns, elapsedMs: 0 }).topic).toBe("close");
  });
});
