import { pickMessages, ROUTE_AREAS, type AreaRoute } from "@/lib/i18n/areas";
import { LanguageProvider } from "@/lib/i18n/provider";

// A server component: gives the client components under this route the strings of its areas
// (lib/i18n/areas.ts), on top of the core strings from the root layout.
export function AreaMessages({ route, children }: { route: AreaRoute; children: React.ReactNode }) {
  return <LanguageProvider strings={pickMessages(ROUTE_AREAS[route])}>{children}</LanguageProvider>;
}
