import { env } from "../config/env.js";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: "Supabase Auth não configurado" });
  }
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  return res.status(200).json({
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY
  });
}
