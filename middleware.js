import { next } from "@vercel/functions";

const ACCESS_COOKIE = "osso_access_token";

function readCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

export default async function middleware(request) {
  const loginUrl = new URL("/login", request.url);
  const token = readCookie(request, ACCESS_COOKIE);
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return Response.redirect(loginUrl, 307);

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${decodeURIComponent(token)}` }
  });
  if (!response.ok) return Response.redirect(loginUrl, 307);
  return next();
}

export const config = { matcher: ["/dashboard", "/dashboard/:path*"] };
