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

/**
 * Sobe um áudio (ogg/opus) enviado manualmente pelo dashboard, reusando o
 * mesmo bucket de imagens (lead-images) - sem criar infraestrutura nova no
 * Supabase. Usado só pra guardar uma cópia reproduzível no histórico do
 * dashboard (a URL de mídia do WhatsApp em si expira).
 */
export async function uploadAudioLead(buffer, phone) {
  const nomeArquivo = `${phone}-${Date.now()}.ogg`;
  const { error } = await supabase.storage
    .from("lead-images")
    .upload(nomeArquivo, Buffer.from(buffer), { contentType: "audio/ogg" });
  if (error) {
    console.error("UPLOAD AUDIO ERROR:", error);
    return null;
  }
  const { data } = supabase.storage.from("lead-images").getPublicUrl(nomeArquivo);
  return data?.publicUrl || null;
}
