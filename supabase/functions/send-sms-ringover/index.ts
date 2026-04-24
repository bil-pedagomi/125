import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const RINGOVER_API = "https://public-api.ringover.com/v2/sms";

interface Recipient {
  phone_e164: string;
  message: string;
  invitee_email: string;
  invitee_name?: string;
  groupe_numero: number;
  calendly_event_uuid: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RINGOVER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "RINGOVER_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { recipients }: { recipients: Recipient[] } = await req.json();
    if (!recipients?.length) {
      return new Response(JSON.stringify({ error: "No recipients" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ email: string; statut: string; error?: string }> = [];

    for (const r of recipients) {
      const row: Record<string, unknown> = {
        calendly_event_uuid: r.calendly_event_uuid,
        invitee_email: r.invitee_email,
        invitee_name: r.invitee_name || null,
        phone_e164: r.phone_e164,
        groupe_numero: r.groupe_numero,
        message_body: r.message,
        statut: "pending",
      };

      try {
        const smsRes = await fetch(RINGOVER_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: apiKey,
          },
          body: JSON.stringify({ to: r.phone_e164, content: r.message }),
        });

        const body = await smsRes.json().catch(() => ({}));
        row.ringover_response = body;
        row.statut = smsRes.ok ? "sent" : "failed";
        if (!smsRes.ok) row.error_message = `HTTP ${smsRes.status}`;

        results.push({ email: r.invitee_email, statut: row.statut as string, error: row.error_message as string | undefined });
      } catch (err) {
        row.statut = "failed";
        row.error_message = String(err);
        results.push({ email: r.invitee_email, statut: "failed", error: String(err) });
      }

      await supabase.from("f125_sms_envoyes").insert(row);
    }

    const sent = results.filter((r) => r.statut === "sent").length;
    const failed = results.filter((r) => r.statut === "failed").length;

    return new Response(JSON.stringify({ sent, failed, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
