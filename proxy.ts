import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicConfig } from "@/lib/env";

// Refreshes the Supabase session cookie before pages render (Next 16 renamed middleware to proxy).
// Visitors without a session cookie (most jurors on `/`) skip the auth round trip entirely.
export async function proxy(request: NextRequest) {
  const cfg = supabasePublicConfig();
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!cfg || !hasSession) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        // Service workers cannot see Set-Cookie; this tells public/sw.js not to keep this page (D52).
        response.headers.set("x-pp-cookies", "1");
      },
    },
  });
  // Validates the token and rotates it when close to expiry; the result itself is not needed here.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/health|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav|ogg|webmanifest|txt)$).*)",
  ],
};
