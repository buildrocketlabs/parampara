import { AreaMessages } from "@/components/parampara/AreaMessages";

// The officer's room: its client components get the officer strings on top of core (lib/i18n/areas.ts).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AreaMessages route="app/i">{children}</AreaMessages>;
}
