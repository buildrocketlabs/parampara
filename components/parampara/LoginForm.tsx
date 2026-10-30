"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { signInWithEmail, type LoginState } from "@/app/actions/session";
import { useLang } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { BiPair } from "./BiPair";
import { Hanate } from "./hanate/Hanate";
import { SubmitButton } from "./SubmitButton";

// Email and password for evaluators who prefer the README credentials. Errors are one kind line
// beside a caring Hanate; the email stays filled so only the password needs retyping.
const INITIAL: LoginState = { error: null, email: "" };

export function LoginForm() {
  const [state, action] = useActionState(signInWithEmail, INITIAL);
  const [shown, setShown] = useState(false);
  const { t } = useLang();
  const form = useRef<HTMLFormElement>(null);

  // An error grows the card; keep Sign in on screen so the retry is one press away.
  useEffect(() => {
    if (state.error) form.current?.querySelector("button[type=submit]")?.scrollIntoView({ block: "nearest" });
  }, [state]);

  return (
    <form ref={form} action={action} className="flex w-full flex-col gap-5 text-left" noValidate>
      <Field id="login-email" label="login.email">
        <input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.email}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className={INPUT}
        />
      </Field>

      <Field id="login-password" label="login.password">
        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={shown ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "login-error" : undefined}
            className={cn(INPUT, "pr-16")}
          />
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            aria-label={t(shown ? "login.hide" : "login.show")}
            className="absolute top-1 right-1 grid size-12 place-items-center rounded-button text-ink-3 hover:bg-sage hover:text-ink"
          >
            {shown ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>
      </Field>

      <div aria-live="polite" className="empty:hidden">
        {state.error && (
          <div
            id="login-error"
            role="alert"
            className="flex items-center gap-3 rounded-card border border-border bg-paper p-3 pr-4 shadow-warm-sm"
          >
            <Hanate state="caring" size={44} label="" className="shrink-0" />
            <p className="text-base leading-snug text-ink">
              <Bi k={state.error} subClassName="text-[14px]" />
            </p>
          </div>
        )}
      </div>

      <SubmitButton pendingLabel="login.pending" className="mt-1 w-full">
        <LogIn aria-hidden />
        <Bi k="login.submit" sub={false} />
      </SubmitButton>
    </form>
  );
}

const INPUT =
  "h-14 w-full rounded-button border border-input bg-paper px-4 text-lg text-ink shadow-warm-sm outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-clay focus-visible:ring-4 focus-visible:ring-flame/30 aria-invalid:border-clay-cta";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: "login.email" | "login.password";
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex flex-wrap gap-x-1.5 font-display text-[17px] font-bold text-ink">
        <BiPair k={label} />
      </label>
      {children}
    </div>
  );
}
