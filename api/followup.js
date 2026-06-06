import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  try {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .in("stage", ["orcamento", "followup_1", "followup_2"]);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }

    const now = Date.now();
    const enviados = [];

    for (const lead of leads || []) {
      const followupCount = lead.followup_count || 0;
      const updatedAt = new Date(lead.updated_at).getTime();
      const lastFollowupAt = lead.last_followup_at
        ? new Date(lead.last_followup_at).getTime()
        : null;

      let deveEnviar = false;
      let texto = "";
      let novoStage = lead.stage;
      let novoFollowupCount = followupCount;

      // 1º follow-up depois de 12h
      if (followupCount === 0) {
        const diffHours = (now - updatedAt) / 1000 / 60 / 60;

        if (diffHours >= 12) {
          deveEnviar = true;
          texto = `Oi! Passando pra retomar seu orçamento 👊

Se ainda quiser fazer sua tattoo, me manda só:
- tamanho aproximado
- local do corpo
- ideia ou referência

Se preferir, também posso te passar opções de horário: 10h / 14h / 17h.`;
          novoStage = "followup_1";
          novoFollowupCount = 1;
        }
      }

      // 2º follow-up 24h após o primeiro
      else if (followupCount === 1 && lastFollowupAt) {
        const diffHours = (now - lastFollowupAt) / 1000 / 60 / 60;

        if (diffHours >= 24) {
          deveEnviar = true;
          texto = `Oi! Só passando mais uma vez pra não deixar seu atendimento em aberto.

Se quiser continuar seu orçamento ou já ver um horário disponível, me chama aqui que eu sigo com você.`;
          novoStage = "followup_2";
          novoFollowupCount = 2;
        }
      }

      // encerra após 2 follow-ups
      else if (followupCount >= 2) {
        await supabase
          .from("leads")
          .update({
            stage: "encerrado",
            updated_at: new Date().toISOString()
          })
          .eq("phone", lead.phone);

        continue;
      }

      if (!deveEnviar) continue;

      const sendResponse = await fetch(
        `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: lead.phone,
            text: { body: texto }
          })
        }
      );

      if (!sendResponse.ok) {
        const sendData = await sendResponse.text();
        console.error("FOLLOWUP SEND ERROR:", sendData);
        continue;
      }

      await supabase.from("messages").insert({
        phone: lead.phone,
        role: "assistant",
        content: texto
      });

      await supabase
        .from("leads")
        .update({
          stage: novoStage,
          followup_count: novoFollowupCount,
          last_followup_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("phone", lead.phone);

      enviados.push({
        phone: lead.phone,
        followup: novoFollowupCount
      });
    }

    return res.status(200).json({
      ok: true,
      enviados
    });
  } catch (err) {
    console.error("FOLLOWUP ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}