// Feedback from any screen (docs/BUILD.md M4.5): shared limits for the sheet and the server action.
export const FEEDBACK_MAX = 500;

export type FeedbackResult =
  | { ok: true; kept: boolean; helpline: "childline" | "telemanas" | null }
  | { ok: false; error: "invalid" | "failed" };
