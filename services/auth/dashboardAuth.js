import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";

const allowedRoles = new Set(["admin", "attendant"]);

function readBearerToken(req) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

/** Validates a Supabase access token and ensures that the user has a CRM role. */
export async function authenticateDashboardRequest(req) {
  const accessToken = readBearerToken(req);
  if (!accessToken || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;

  const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !user) return null;

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("id,email,role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !allowedRoles.has(profile.role)) return null;

  return { user, profile };
}

export async function requireDashboardUser(req, res) {
  const auth = await authenticateDashboardRequest(req);
  if (!auth) {
    res.status(401).json({ ok: false, error: "Não autenticado" });
    return null;
  }
  return auth;
}
