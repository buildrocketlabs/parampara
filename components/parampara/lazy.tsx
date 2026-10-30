"use client";

import dynamic from "next/dynamic";

// Heavy pieces load only when needed, so the teacher shell stays under 200 KB of JS on first load
// (DESIGN §10). Same props as the components they wrap.
export const LazyTraceDrawer = dynamic(() => import("./TraceDrawer").then((m) => m.TraceDrawer), {
  ssr: false,
});

export const LazyCelebration = dynamic(() => import("./Celebration").then((m) => m.Celebration), {
  ssr: false,
});
