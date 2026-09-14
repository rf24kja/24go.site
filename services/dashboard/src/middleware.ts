import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOCALES = ["en", "ru"] as const;
const DEFAULT_LOCALE = "en";

function detectLocale(request: NextRequest): string {
  const { pathname } = request.nextUrl;

  // 1. URL ?locale= param (explicit choice)
  const urlLocale = request.nextUrl.searchParams.get("locale");
  if (urlLocale && LOCALES.includes(urlLocale as any)) return urlLocale;

  // 2. Cookie (remembered preference)
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && LOCALES.includes(cookieLocale as any)) return cookieLocale;

  // 3. Accept-Language header
  const acceptLang = request.headers.get("accept-language") || "";
  for (const loc of LOCALES) {
    if (acceptLang.toLowerCase().startsWith(loc)) return loc;
  }

  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip internal paths, API routes, static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const locale = detectLocale(request);

  // Set locale as REQUEST header (readable by layout via headers())
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", locale);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Also set cookie for client-side reading
  response.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
