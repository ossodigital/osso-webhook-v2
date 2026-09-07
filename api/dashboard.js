import fetch from "node-fetch";
import { env } from "../config/env.js";
import { requireDashboardUser } from "../services/auth/dashboardAuth.js";

const GET_ACTIONS = new Set(["ping", "leads", "messages", "messages-by-phone"]);
const POST_ACTIONS = new Set(["send-message", "send-audio", "takeover", "release-ai"]);

/**
 * Supabase-authenticated facade for the unchanged CRM API.
 * It keeps the legacy dashboard token exclusively on the server.
 */
export default async function handler(req, res) {
  if (!(await requireDashboardUser(req, res))) return;

  const action = String(req.query.debug || "");
  const allowed = req.method === "GET" ? GET_ACTIONS.has(action) : req.method === "POST" && POST_ACTIONS.has(action);
  if (!allowed) return res.status(405).json({ ok: false, error: "Ação não permitida" });
  if (!env.DASHBOARD_TOKEN) return res.status(503).json({ ok: false, error: "Dashboard não configurado" });

  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const target = new URL("/api/meta", `${protocol}://${host}`);
  target.searchParams.set("debug", action);

  if (req.method === "GET") {
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== "debug" && value != null) target.searchParams.set(key, String(value));
    }
    target.searchParams.set("token", env.DASHBOARD_TOKEN);
  }

  const upstream = await fetch(target, req.method === "POST" ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(req.body || {}), token: env.DASHBOARD_TOKEN })
  } : undefined);

  const contentType = upstream.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  return res.status(upstream.status).send(await upstream.text());
}
