// Stands in for the app's `@/lib/utils` when the video imports Hanate's artwork (remotion.config.ts).
export const cn = (...names: Array<string | false | null | undefined>) =>
  names.filter(Boolean).join(" ");
