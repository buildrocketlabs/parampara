import { AreaMessages } from "@/components/parampara/AreaMessages";

// The master's room: its client components get the master strings on top of core (lib/i18n/areas.ts).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AreaMessages route="app/m">{children}</AreaMessages>;
}
