import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOCALES = ["en", "ru"] as const;
const DEFAULT_LOCALE = "en";
const COOKIE_NAME = "NEXT_LOCALE";

function isValidLocale(pathname: string): boolean {
  const first = pathname.split("/")[1];
  return LOCALES.includes(first as any);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for internal Next.js paths, API routes, static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // static files (favicon, robots, etc.)
  ) {
    return NextResponse.next();
  }

  // If URL already has locale prefix, set cookie and continue
  if (isValidLocale(pathname)) {
    const locale = pathname.split("/")[1];
    const response = NextResponse.next();
    response.cookies.set(COOKIE_NAME, locale, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: "lax",
    });
    return response;
  }

  // No locale prefix: detect from cookie → Accept-Language → default
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieLocale && LOCALES.includes(cookieLocale as any)) {
    const response = NextResponse.next();
    response.cookies.set(COOKIE_NAME, cookieLocale, { path: "/", maxAge: 365 * 24 * 60 * 60, sameSite: "lax" });
    return response;
  }

  // Try Accept-Language header
  const acceptLang = request.headers.get("accept-language") || "";
  let detected = DEFAULT_LOCALE;
  for (const loc of LOCALES) {
    if (acceptLang.toLowerCase().startsWith(loc)) {
      detected = loc;
      break;
    }
  }

  // Set cookie and continue
  const response = NextResponse.next();
  response.cookies.set(COOKIE_NAME, detected, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
