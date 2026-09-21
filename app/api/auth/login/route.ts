import { createSessionToken, safeEqual, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const expectedUsername = process.env.APP_USERNAME || "";
  const expectedPassword = process.env.APP_PASSWORD || "";

  if (
    !expectedUsername ||
    !expectedPassword ||
    !safeEqual(username, expectedUsername) ||
    !safeEqual(password, expectedPassword)
  ) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(SESSION_COOKIE, createSessionToken(username), sessionCookieOptions);
  return response;
}
