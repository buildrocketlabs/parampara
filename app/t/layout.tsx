import { AreaMessages } from "@/components/parampara/AreaMessages";

// The teacher's room: its client components get the teacher strings on top of core (lib/i18n/areas.ts).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AreaMessages route="app/t">{children}</AreaMessages>;
}
