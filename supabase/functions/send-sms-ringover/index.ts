import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const RINGOVER_BASE = "https://public-api.ringover.com/v2";
const SLEEP_MS = 150;

interface Destinataire {
  invitee_uuid?: string;
  prenom: string;
  numero: string;
  message: string;
}

interface RequestBody {
  calendly_event_uuid: string;
  groupe_numero: number;
  date_formation?: string;
  heure_groupe?: string;
  destinataires: Destinataire[];
}

function normalizePhone(num: string): string {
  const digits = num.replace(/[^0-9]/g, "");
  if (digits.startsWith("33")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "33" + digits.slice(1);
  if (digits.length === 9) return "33" + digits;
  return digits;
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

    const body: RequestBody = await req.json();
    const { calendly_event_uuid, groupe_numero, date_formation, heure_groupe, destinataires } = body;

    if (!destinataires?.length) {
      return new Response(
        JSON.stringify({ error: "No destinataires" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const details: Array<{
      invitee_uuid?: string;
      numero: string;
      statut: string;
      message_id?: string;
      error?: string;
    }> = [];

    for (let i = 0; i < destinataires.length; i++) {
      const d = destinataires[i];
      const normalized = normalizePhone(d.numero);

      const { data: inserted } = await supabase.from("sms_queue").insert({
        telephone: d.numero,
        prenom: d.prenom,
        message: d.message,
        date_formation: date_formation || null,
        heure_groupe: heure_groupe || `${groupe_numero}`,
        calendly_event_uuid,
        invitee_uuid: d.invitee_uuid || null,
        groupe_numero,
        statut: "pending",
      }).select("id").single();

      const rowId = inserted?.id;

      try {
        const smsPayload: Record<string, string> = {
          from_number: normalizePhone(fromNumber || ""),
          to_number: normalized,
          content: d.message,
        };

        const smsRes = await fetch(`${RINGOVER_BASE}/push/sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: apiKey,
          },
          body: JSON.stringify(smsPayload),
        });

        const smsBody = await smsRes.json().catch(() => ({}));

        if (smsRes.ok || smsRes.status === 202) {
          const messageId = smsBody?.message_id || smsBody?.id || null;
          if (rowId) {
            await supabase.from("sms_queue").update({
              statut: "sent",
              sent_at: new Date().toISOString(),
              ringover_message_id: String(messageId),
            }).eq("id", rowId);
          }
          details.push({ invitee_uuid: d.invitee_uuid, numero: d.numero, statut: "sent", message_id: String(messageId) });
        } else {
          const errMsg = `HTTP ${smsRes.status}: ${JSON.stringify(smsBody)}`;
          if (rowId) {
            await supabase.from("sms_queue").update({
              statut: "failed",
              erreur_message: errMsg,
            }).eq("id", rowId);
          }
          details.push({ invitee_uuid: d.invitee_uuid, numero: d.numero, statut: "failed", error: errMsg });
        }
      } catch (err) {
        const errMsg = String(err);
        if (rowId) {
          await supabase.from("sms_queue").update({
            statut: "failed",
            erreur_message: errMsg,
          }).eq("id", rowId);
        }
        details.push({ invitee_uuid: d.invitee_uuid, numero: d.numero, statut: "failed", error: errMsg });
      }

      if (i < destinataires.length - 1) await sleep(SLEEP_MS);
    }

    const success = details.filter((d) => d.statut === "sent").length;
    const failed = details.filter((d) => d.statut === "failed").length;

    await supabase.from("sync_log_unifie").insert({
      source: "ringover_sms",
      status: failed === 0 ? "success" : "partial",
      nb_fetched: destinataires.length,
      nb_inserted: success,
      nb_skipped: failed,
      metadata: { details },
    });

    return new Response(
      JSON.stringify({ total: destinataires.length, success, failed, details }),
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
