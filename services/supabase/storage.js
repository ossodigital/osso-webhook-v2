import { supabase } from "./client.js";

export async function uploadImagemLead(buffer, phone) {
  const nomeArquivo = `${phone}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("lead-images")
    .upload(nomeArquivo, Buffer.from(buffer), { contentType: "image/jpeg" });
  if (error) {
    console.error("UPLOAD IMAGEM ERROR:", error);
    return null;
  }
  const { data } = supabase.storage.from("lead-images").getPublicUrl(nomeArquivo);
  return data?.publicUrl || null;
}
