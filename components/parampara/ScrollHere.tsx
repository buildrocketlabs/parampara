"use client";

import { useEffect, useRef } from "react";

// Brings its spot into view once it appears, for content that streams in after the page (a hash
// in the URL cannot reach an element that is not there yet).
export function ScrollHere() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "start" });
  }, []);
  return <span ref={ref} aria-hidden className="block scroll-mt-6" />;
}
