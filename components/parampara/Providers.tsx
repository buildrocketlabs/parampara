"use client";

import { LanguageProvider, type Strings } from "@/lib/i18n/provider";
import { ToastProvider } from "./Toast";

export function Providers({ strings, children }: { strings: Strings; children: React.ReactNode }) {
  return (
    <LanguageProvider strings={strings}>
      <ToastProvider>{children}</ToastProvider>
    </LanguageProvider>
  );
}
