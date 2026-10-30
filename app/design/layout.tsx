import { AreaMessages } from "@/components/parampara/AreaMessages";

// The design gallery: its client components get the every area's strings on top of core (lib/i18n/areas.ts).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AreaMessages route="app/design">{children}</AreaMessages>;
}
