import { Bi } from "./Bi";
import { SampleBadge } from "./Badges";
import { ProgressDots } from "./ProgressDots";

// Where you are in the two step welcome: two dots and a plain line (consent, then language).
// The Sample badge rides on this row, so the welcome needs no second header row on a phone.
export function WelcomeSteps({ step, sample = false }: { step: 1 | 2; sample?: boolean }) {
  return (
    <div className="rise flex min-h-7 items-center gap-3">
      <ProgressDots count={2} current={step - 1} className="px-1" />
      <span className="font-display text-[15px] font-semibold text-ink-3">
        <Bi k={step === 1 ? "welcome.step1" : "welcome.step2"} sub={false} />
      </span>
      {sample && <SampleBadge className="ml-auto" />}
    </div>
  );
}
