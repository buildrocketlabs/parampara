"use client";

import { useActionState, useState } from "react";
import { Minus, Plus, Sparkles } from "lucide-react";
import { makeInvites, type MakeInvitesState } from "@/app/actions/invites";
import { useLang } from "@/lib/i18n/provider";
import {
  INVITABLE_ROLES,
  MAX_DISTRICT_LENGTH,
  MAX_INVITES_PER_BATCH,
  MAX_LABEL_LENGTH,
  type InvitableRole,
} from "@/lib/invites/types";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { BiText } from "./BiText";
import { Hanate } from "./hanate/Hanate";
import { ROLE_ICON, ROLE_NAME } from "./role-meta";
import { SubmitButton } from "./SubmitButton";

// Make 1 to 50 links in one go. Native inputs throughout (radios for the role, a number field
// with − and + beside it), so it works by keyboard and even before JavaScript arrives.
const INITIAL: MakeInvitesState = { error: null };

export function InviteForm({ district }: { district: string }) {
  const [state, action] = useActionState(makeInvites, INITIAL);
  const [count, setCount] = useState(5);
  const { t } = useLang();
  const clamp = (n: number) => Math.min(MAX_INVITES_PER_BATCH, Math.max(1, Math.round(n) || 1));

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="invite-count" className={LABEL}>
          <Bi k="invites.count" sub={false} />
        </label>
        <div className="flex items-center gap-2">
          <StepButton label={t("invites.less")} onClick={() => setCount((c) => clamp(c - 1))} disabled={count <= 1}>
            <Minus aria-hidden />
          </StepButton>
          <input
            id="invite-count"
            name="count"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_INVITES_PER_BATCH}
            value={count}
            onChange={(e) => setCount(clamp(Number(e.target.value)))}
            aria-describedby="invite-count-hint"
            className={cn(INPUT, "w-24 text-center font-display text-2xl font-bold")}
          />
          <StepButton
            label={t("invites.more")}
            onClick={() => setCount((c) => clamp(c + 1))}
            disabled={count >= MAX_INVITES_PER_BATCH}
          >
            <Plus aria-hidden />
          </StepButton>
        </div>
        <p id="invite-count-hint" className="text-[14px] text-ink-3">
          <Bi k="invites.count.hint" sub={false} />
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={cn(LABEL, "mb-2")}>
          <Bi k="invites.role" sub={false} />
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {INVITABLE_ROLES.map((role) => (
            <RoleChoice key={role} role={role} />
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="invite-label" className={LABEL}>
          <Bi k="invites.label" sub={false} />
        </label>
        <input
          id="invite-label"
          name="label"
          type="text"
          maxLength={MAX_LABEL_LENGTH}
          autoComplete="off"
          placeholder={t("invites.label.placeholder")}
          aria-describedby="invite-label-hint"
          className={INPUT}
        />
        <p id="invite-label-hint" className="text-[14px] text-ink-3">
          <Bi k="invites.label.hint" sub={false} />
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="invite-district" className={LABEL}>
          <Bi k="invites.district" sub={false} />
        </label>
        <input
          id="invite-district"
          name="district"
          type="text"
          maxLength={MAX_DISTRICT_LENGTH}
          defaultValue={district}
          autoComplete="off"
          placeholder={t("invites.district.placeholder")}
          className={INPUT}
        />
      </div>

      {state.error && (
        <div role="alert" className="flex items-center gap-3 rounded-card bg-cream p-3 pr-4">
          <Hanate state="caring" size={40} label="" className="shrink-0" />
          <p className="text-base leading-snug">
            <Bi k={state.error} sub={false} />
          </p>
        </div>
      )}

      <SubmitButton pendingLabel="invites.submitting" className="w-full">
        <Sparkles aria-hidden />
        {count === 1 ? (
          <Bi k="invites.submit.one" sub={false} />
        ) : (
          <BiText text="invites.submit.many" vars={{ n: count }} sub={false} />
        )}
      </SubmitButton>
    </form>
  );
}

const LABEL = "font-display text-[17px] font-bold text-ink";
const INPUT =
  "h-14 w-full rounded-button border border-input bg-paper px-4 text-lg text-ink shadow-warm-sm outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-clay focus-visible:ring-4 focus-visible:ring-flame/30";

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-14 shrink-0 place-items-center rounded-button border border-border bg-paper text-ink lip-paper transition-[translate,box-shadow] duration-100 hover:-translate-y-px active:translate-y-1 active:shadow-none disabled:opacity-50 [&_svg]:size-5"
    >
      {children}
    </button>
  );
}

function RoleChoice({ role }: { role: InvitableRole }) {
  const Icon = ROLE_ICON[role];
  return (
    <label
      className={cn(
        "flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-button border border-border bg-paper p-2 text-center shadow-warm-sm transition-colors duration-150",
        "has-[:checked]:border-clay-cta has-[:checked]:bg-clay-cta has-[:checked]:text-white",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-clay",
      )}
    >
      <input
        type="radio"
        name="role"
        value={role}
        defaultChecked={role === "teacher"}
        className="sr-only"
      />
      <Icon className="size-5" strokeWidth={2.2} aria-hidden />
      <span className="font-display text-[15px] leading-tight font-bold">
        <Bi k={ROLE_NAME[role]} sub={false} />
      </span>
    </label>
  );
}
