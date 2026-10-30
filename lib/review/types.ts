// What a reviewer sees for one draft practice card (DESIGN §4 PracticeCard, docs/BUILD.md M3.1):
// every field beside the exact moments of the recording it came from.

export type Bi = { kn: string; en: string };

export type ReviewStep = Bi & { evidenceSegmentIds: number[] };

export type ReviewCard = {
  id: string;
  status: "draft" | "approved" | "rejected";
  isSample: boolean;
  title: Bi;
  problem: Bi;
  steps: ReviewStep[];
  materials: Bi[];
  why: Bi | null;
  gradeBand: string | null;
  subject: string | null;
  topic: string | null;
  flags: string[];
  evidenceSegmentIds: number[];
  quoteSegmentId: number | null;
  createdAt: string;
  master: {
    id: string;
    name: string | null;
    years: number | null;
    district: string | null;
    consented: boolean;
    voicePublic: boolean;
  };
  interviewId: string | null;
};

export type ReviewSegment = {
  id: number;
  startMs: number;
  endMs: number;
  kn: string;
  en: string | null;
  speaker: string | null;
  /** A child's name was removed from this moment: its audio is never played to teachers. */
  redacted: boolean;
};

export type DraftSummary = {
  id: string;
  title: Bi;
  topic: string | null;
  gradeBand: string | null;
  steps: number;
  flags: string[];
  isSample: boolean;
  masterName: string | null;
  createdAt: string;
};
