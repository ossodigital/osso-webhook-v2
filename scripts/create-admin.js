import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FIRST_ADMIN_EMAIL", "FIRST_ADMIN_PASSWORD"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(", ")}`);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const { data, error } = await supabase.auth.admin.createUser({
  email: process.env.FIRST_ADMIN_EMAIL,
  password: process.env.FIRST_ADMIN_PASSWORD,
  email_confirm: true
});
if (error) throw error;
const { error: profileError } = await supabase.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
if (profileError) throw profileError;
console.log(`Administrador criado: ${data.user.email}`);
