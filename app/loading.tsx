import { Bi } from "@/components/parampara/Bi";
import { Hanate } from "@/components/parampara/hanate/Hanate";

// Honest, calm loading: Hanate thinking, never a bare spinner (DESIGN §2.7).
export default function Loading() {
  return (
    <main id="main"
      aria-busy="true"
      className="bg-dusk-gradient paper-grain flex min-h-dvh flex-col items-center justify-center px-5 text-center"
    >
      <Hanate state="thinking" size={140} label="Hanate" />
      <p className="mt-4 text-lg text-ink-3">
        <Bi k="loading.body" subClassName="text-base" />
      </p>
    </main>
  );
}
