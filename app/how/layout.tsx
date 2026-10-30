import { AreaMessages } from "@/components/parampara/AreaMessages";

// How it works: its client components get the public strings on top of core (lib/i18n/areas.ts).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AreaMessages route="app/how">{children}</AreaMessages>;
}
