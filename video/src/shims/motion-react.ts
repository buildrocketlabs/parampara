// Types only: the app's hanate/variants.ts names Motion's types, which the video does not install.
// The video reads those keyframes itself (src/components/Hanate.tsx), so plain records are enough.
export type Transition = Record<string, unknown>;
export type TargetAndTransition = Record<string, unknown>;
