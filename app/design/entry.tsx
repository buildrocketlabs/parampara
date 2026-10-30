import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BiPair } from "@/components/parampara/BiPair";
import { Ember } from "@/components/parampara/Ember";
import { RoleDoor } from "@/components/parampara/RoleDoor";
import { WelcomeSteps } from "@/components/parampara/WelcomeSteps";
import { Section, Specimen } from "./parts";

// M1 entry and access pieces. SessionBar, SubmitButton and the invite tools need a session or a
// form in flight, so they are shown live at /t, /welcome and /r/invites (docs/demos/M1).
export function EntrySection() {
  return (
    <Section id="entry" name="Entry and access" file="RoleDoor.tsx" desc="design.s.entry">
      <Specimen label="door · one tap demo entry (signs in)" surface="dusk" className="md:row-span-2">
        <RoleDoor role="teacher" body="door.teacher.body" featured index={0} />
      </Specimen>
      <Specimen label="Ember · pending, never a spinner">
        <span className="inline-flex items-center gap-2 font-display text-lg font-bold text-ink-3">
          <Ember /> …
        </span>
      </Specimen>
      <Specimen label="WelcomeSteps · 1 and 2" surface="cream">
        <div className="flex flex-col gap-4">
          <WelcomeSteps step={1} />
          <WelcomeSteps step={2} />
        </div>
      </Specimen>
      <Specimen label="BiPair · both languages on one press">
        <Button className="w-full" tabIndex={-1}>
          <Check aria-hidden />
          <BiPair k="welcome.agree" />
        </Button>
      </Specimen>
    </Section>
  );
}
