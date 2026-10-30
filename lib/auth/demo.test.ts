import { describe, expect, it } from "vitest";
import { matchDemoAccount, plainName } from "./demo";
import { signInErrorKey } from "./errors";
import { DEMO_ACCOUNTS } from "./roles";

describe("demo sign in", () => {
  it("matches README credentials however the email is typed, but never a wrong password", () => {
    const t = DEMO_ACCOUNTS.teacher;
    expect(matchDemoAccount(`  ${t.email.toUpperCase()} `, t.password)?.role).toBe("teacher");
    expect(matchDemoAccount(t.email, t.password.toLowerCase())).toBeNull();
    expect(matchDemoAccount(t.email, DEMO_ACCOUNTS.master.password)).toBeNull();
    expect(matchDemoAccount("someone@example.com", t.password)).toBeNull();
  });

  it("drops the (Sample) suffix the badge already says", () => {
    expect(plainName("Deepa (Sample)")).toBe("Deepa");
    expect(plainName("Shivappa K Hosamani")).toBe("Shivappa K Hosamani");
    expect(plainName(null)).toBeNull();
    expect(plainName(" (Sample)")).toBeNull();
  });

  it("turns auth errors into one kind line each, never the raw message", () => {
    expect(signInErrorKey({ code: "invalid_credentials", status: 400 })).toBe("login.error.wrong");
    expect(signInErrorKey({ code: "over_request_rate_limit", status: 429 })).toBe("login.error.busy");
    expect(signInErrorKey({ status: 429 })).toBe("login.error.busy");
    expect(signInErrorKey({ code: "user_banned", status: 400 })).toBe("login.error.closed");
    expect(signInErrorKey({ status: 500 })).toBe("login.error.network");
    expect(signInErrorKey(null)).toBe("login.error.network");
  });
});
