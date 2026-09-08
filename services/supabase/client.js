import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";

// Cliente de confiança usado apenas no backend (nunca chega ao navegador).
// Usa a service_role (bypassa RLS por padrao) para nao depender de policies
// nas tabelas operacionais (leads, messages, handoffs, etc). Mantem
// SUPABASE_KEY como fallback para nao quebrar ambientes antigos que ainda
// nao tenham a service_role configurada.
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY
);
