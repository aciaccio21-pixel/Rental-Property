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
    return new NextResponse(null, { status: 303, headers: { Location: "/login?error=1" } });
  }

  const response = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  response.cookies.set(SESSION_COOKIE, createSessionToken(username), sessionCookieOptions);
  return response;
}
