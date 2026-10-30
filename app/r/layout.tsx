import { AreaMessages } from "@/components/parampara/AreaMessages";

// The reviewer's room: its client components get the review strings on top of core (lib/i18n/areas.ts).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AreaMessages route="app/r">{children}</AreaMessages>;
}
