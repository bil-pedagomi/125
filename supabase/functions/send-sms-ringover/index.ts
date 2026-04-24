import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const RINGOVER_BASE = "https://public-api.ringover.com/v2";
const SLEEP_MS = 150;

interface Recipient {
  phone_e164: string;
  message: string;
  invitee_email: string;
  invitee_name?: string;
  invitee_uuid?: string;
  groupe_numero: number;
  calendly_event_uuid: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const apiKey = Deno.env.get("RINGOVER_API_KEY");
    const fromNumber = Deno.env.get("RINGOVER_SMS_FROM_NUMBER");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "RINGOVER_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { recipients }: { recipients: Recipient[] } = await req.json();
    if (!recipients?.length) {
      return new Response(
        JSON.stringify({ error: "No recipients" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<{ email: string; statut: string; error?: string }> = [];

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];

      // Insert pending row into sms_queue
      const { data: inserted } = await supabase.from("sms_queue").insert({
        telephone: r.phone_e164,
        prenom: r.invitee_name || r.invitee_email,
        message: r.message,
        heure_groupe: `${r.groupe_numero}`,
        calendly_event_uuid: r.calendly_event_uuid,
        invitee_uuid: r.invitee_uuid || null,
        statut: "pending",
      }).select("id").single();

      const rowId = inserted?.id;

      try {
        const smsPayload: Record<string, string> = {
          to: r.phone_e164,
          content: r.message,
        };
        if (fromNumber) smsPayload.from = fromNumber;

        const smsRes = await fetch(`${RINGOVER_BASE}/sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: apiKey,
          },
          body: JSON.stringify(smsPayload),
        });

        const body = await smsRes.json().catch(() => ({}));

        if (smsRes.ok) {
          if (rowId) {
            await supabase.from("sms_queue").update({
              statut: "sent",
              sent_at: new Date().toISOString(),
              ringover_message_id: body?.message_id || body?.id || null,
            }).eq("id", rowId);
          }
          results.push({ email: r.invitee_email, statut: "sent" });
        } else {
          const errMsg = `HTTP ${smsRes.status}: ${JSON.stringify(body)}`;
          if (rowId) {
            await supabase.from("sms_queue").update({
              statut: "failed",
              erreur_message: errMsg,
            }).eq("id", rowId);
          }
          results.push({ email: r.invitee_email, statut: "failed", error: errMsg });
        }
      } catch (err) {
        const errMsg = String(err);
        if (rowId) {
          await supabase.from("sms_queue").update({
            statut: "failed",
            erreur_message: errMsg,
          }).eq("id", rowId);
        }
        results.push({ email: r.invitee_email, statut: "failed", error: errMsg });
      }

      // Rate limit between sends
      if (i < recipients.length - 1) await sleep(SLEEP_MS);
    }

    const sent = results.filter((r) => r.statut === "sent").length;
    const failed = results.filter((r) => r.statut === "failed").length;

    // Log to sync_log_unifie
    await supabase.from("sync_log_unifie").insert({
      source: "ringover_sms",
      status: failed === 0 ? "success" : "partial",
      nb_fetched: recipients.length,
      nb_inserted: sent,
      nb_skipped: failed,
      metadata: { results },
    });

    return new Response(
      JSON.stringify({ sent, failed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    await supabase.from("sync_log_unifie").insert({
      source: "ringover_sms",
      status: "error",
      error_message: String(err),
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
