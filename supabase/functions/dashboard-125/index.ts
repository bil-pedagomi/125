import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const DASHBOARD_API_KEY = Deno.env.get('DASHBOARD_API_KEY') || 'eb498a94-3602-46a4-bce7-df288002402d';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function normPhone(p: string | null): string | null {
  if (!p) return null;
  const d = p.replace(/[^0-9]/g, '');
  if (d.startsWith('33') && d.length === 11) return d.slice(2);
  if (d.startsWith('330') && d.length === 12) return d.slice(3);
  if (d.startsWith('0') && d.length === 10) return d.slice(1);
  if (d.length === 9) return d;
  if (d.length > 9) return d.slice(-9);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  if (url.searchParams.get('key') !== DASHBOARD_API_KEY) {
    return new Response(JSON.stringify({error:'Unauthorized'}), {status:401, headers:corsHeaders});
  }

  try {
    const { data: sessions } = await sb.from('v_125_sessions')
      .select('id, calendly_uuid, event_type_name, start_time, status, nb_invitees, invitee_name, invitee_email, questions_and_answers')
      .order('start_time', { ascending: false });

    const sessionIds = (sessions || []).map((s: any) => s.id);
    let inviteesRaw: any[] = [];
    if (sessionIds.length > 0) {
      const { data } = await sb.from('calendly_invitees')
        .select('id, invitee_uuid, calendly_event_id, calendly_event_uuid, name, email, phone, status, rescheduled, payment_amount, payment_currency, no_show, calendly_created_at, questions_and_answers')
        .in('calendly_event_id', sessionIds)
        .order('calendly_event_id', { ascending: false });
      inviteesRaw = data || [];
    }

    // --- FIX REPORTS : retirer les invites annules pour cause de report ---
    // Regle autoritaire : rescheduled=true (flag API Calendly) => report => on masque.
    // Filet de securite (tant que le flag n'est pas encore synchronise) : un 'canceled'
    // dont le meme email a une place 'active' 125 a une date >= est considere comme report.
    // On CONSERVE les 'canceled' non reprogrammes (= vraie annulation, vente ferme).
    const startBySession = new Map<number, string>();
    for (const s of (sessions || [])) startBySession.set(s.id, s.start_time);
    const activeStartsByEmail = new Map<string, string[]>();
    for (const i of inviteesRaw) {
      if (i.status === 'active') {
        const em = (i.email || '').toLowerCase().trim();
        const st = startBySession.get(i.calendly_event_id);
        if (em && st) {
          if (!activeStartsByEmail.has(em)) activeStartsByEmail.set(em, []);
          activeStartsByEmail.get(em)!.push(st);
        }
      }
    }
    inviteesRaw = inviteesRaw.filter((i: any) => {
      if (i.status !== 'canceled') return true;
      if (i.rescheduled === true) return false;
      const em = (i.email || '').toLowerCase().trim();
      const st = startBySession.get(i.calendly_event_id) || '';
      const actives = activeStartsByEmail.get(em) || [];
      const reprogramme = actives.some((a) => a >= st);
      return !reprogramme;
    });

    // --- CARTES 125 deja fabriquees (etat on/off par invite) ---
    const carteByUuid = new Map<string, boolean>();
    const inviteeUuids = inviteesRaw.map((i: any) => i.invitee_uuid).filter(Boolean);
    if (inviteeUuids.length > 0) {
      const { data: cartes } = await sb.from('f125_carte_125')
        .select('invitee_uuid, carte_faite')
        .in('invitee_uuid', inviteeUuids);
      for (const c of (cartes || [])) carteByUuid.set(c.invitee_uuid, c.carte_faite === true);
    }

    const { data: formData } = await sb.from('v_125_formulaires').select('*').order('submit_date', { ascending: false });
    const formulaires = formData || [];
    const formByEmail = new Map<string, any>();
    for (const f of formulaires) {
      const email = (f.email || '').toLowerCase().trim();
      if (email && !formByEmail.has(email)) formByEmail.set(email, f);
    }

    const { data: matchData } = await sb.from('v_125_form_matching').select('invitee_id, form_email, match_method');
    const formMatchByInvitee = new Map<number, {form_email: string, method: string}>();
    for (const m of (matchData || [])) {
      if (!formMatchByInvitee.has(m.invitee_id)) {
        formMatchByInvitee.set(m.invitee_id, { form_email: m.form_email, method: m.match_method });
      }
    }

    const { data: appels } = await sb.from('v_125_appels').select('*');
    const appelByEmail = new Map<string, any>();
    for (const a of (appels || [])) {
      const email = (a.email || '').toLowerCase().trim();
      if (email) appelByEmail.set(email, a);
    }

    const { data: allAppels } = await sb.from('crm_appels_analyses')
      .select('telephone, date_appel, duree_secondes, resume, motifs, type_appel')
      .order('date_appel', { ascending: false })
      .limit(5000);
    const appelsByPhone = new Map<string, any[]>();
    for (const r of (allAppels || [])) {
      const norm = normPhone(r.telephone);
      if (!norm) continue;
      if (!appelsByPhone.has(norm)) appelsByPhone.set(norm, []);
      appelsByPhone.get(norm)!.push({ date: r.date_appel, duree: r.duree_secondes, resume: r.resume || null, motifs: r.motifs || null, type: r.type_appel });
    }

    // RELANCES SMS par email
    const { data: relancesRaw } = await sb.from('relances_typeform')
      .select('email, type_relance, statut, date_formation, sent_at, telephone')
      .order('sent_at', { ascending: false })
      .limit(5000);
    const relancesByEmail = new Map<string, any[]>();
    for (const r of (relancesRaw || [])) {
      const email = (r.email || '').toLowerCase().trim();
      if (!email) continue;
      if (!relancesByEmail.has(email)) relancesByEmail.set(email, []);
      relancesByEmail.get(email)!.push({
        type: r.type_relance,
        statut: r.statut,
        date_envoi: r.sent_at,
        date_formation: r.date_formation,
      });
    }

    const { data: emails } = await sb.from('emails_clients')
      .select('email_expediteur, email_destinataire, sujet, body_extrait, date_reception, direction, categorie, sous_categorie, boite_mail')
      .eq('direction', 'inbound').order('date_reception', { ascending: false }).limit(1000);

    const caByMonth = new Map<string, number>();
    for (const s of (sessions || [])) {
      const month = (s.start_time || '').slice(0, 7);
      if (!month) continue;
      const invCount = inviteesRaw.filter((i: any) => i.calendly_event_id === s.id).length;
      const actual = invCount > 0 ? invCount : (s.nb_invitees || 0);
      caByMonth.set(month, (caByMonth.get(month) || 0) + actual * 199);
    }
    const caComparaison: any[] = [];
    for (const month of Array.from(caByMonth.keys()).sort()) {
      const [year, m] = month.split('-');
      const prevMonth = `${Number(year) - 1}-${m}`;
      const ca = caByMonth.get(month) || 0;
      const caPrev = caByMonth.get(prevMonth) || 0;
      caComparaison.push({ mois: month, ca, ca_n1: caPrev, variation_pct: caPrev > 0 ? Math.round(((ca - caPrev) / caPrev) * 100) : null });
    }

    const inviteesEnriched = inviteesRaw.map((inv: any) => {
      const email = (inv.email || '').toLowerCase().trim();
      const match = formMatchByInvitee.get(inv.id);
      const formEmail = match?.form_email || email;
      const matchMethod = match?.method || 'none';
      const form = formByEmail.get(formEmail);
      const appel = appelByEmail.get(email);
      const phoneNorm = normPhone(inv.phone);
      const allCalls = phoneNorm ? (appelsByPhone.get(phoneNorm) || []) : [];
      const relances = relancesByEmail.get(email) || [];
      return {
        ...inv,
        // ETAT CARTE 125 (on/off)
        carte_faite: carteByUuid.get(inv.invitee_uuid) === true,
        form_rempli: form ? true : false,
        form_match_method: form ? matchMethod : null,
        neph: form?.neph || null, date_obtention_permis_b: form?.date_obtention_permis_b || null,
        niveau_scooter: form?.niveau_scooter || null, deja_conduit: form?.deja_conduit || null,
        occasions_conduite: form?.occasions_conduite || null, derniere_conduite: form?.derniere_conduite || null,
        creneau_prefere: form?.creneau_prefere || null, temps_trajet: form?.temps_trajet || null,
        source_acquisition: form?.source_acquisition || null, raison_reservation: form?.raison_reservation || null,
        commentaires: form?.commentaires || null,
        // Accompagnement (Typeform : « venez-vous avec un proche ? » + nom/prenom).
        // form_nom est le nom tel qu'ecrit sur le formulaire : il sert de nom
        // alternatif au rapprochement de l'accompagnant declare (texte libre).
        form_nom: form?.nom || null,
        reserve_samedi: form?.reserve_samedi || null,
        avec_un_proche: form?.avec_un_proche || null,
        accompagnant_nom_complet: form?.accompagnant_nom_complet || null,
        photo_permis_recto: form?.photo_permis_recto || null, photo_permis_verso: form?.photo_permis_verso || null,
        photo_identite: form?.photo_identite || null, photo_signature: form?.photo_signature || null,
        form_submit_date: form?.submit_date || null,
        a_appele: appel?.a_appele === true, nb_appels: appel?.nb_appels || 0,
        appels_detail: allCalls,
        relances: relances,
        nb_relances: relances.filter((r: any) => r.statut === 'sent').length,
      };
    });

    const sessionsEnriched = (sessions || []).map((s: any) => {
      const email = (s.invitee_email || '').toLowerCase().trim();
      const form = formByEmail.get(email);
      const appel = appelByEmail.get(email);
      return { ...s, form_rempli: form ? true : false, a_appele: appel?.a_appele === true, nb_appels: appel?.nb_appels || 0 };
    });

    const appelsArr = appels || [];
    const withTel = appelsArr.filter((a: any) => a.tel_norm && a.tel_norm !== '');
    const kpis = {
      total_sessions: sessionsEnriched.length,
      total_invitees: inviteesEnriched.length,
      total_form_rempli: formulaires.length,
      form_match_count: inviteesEnriched.filter((i: any) => i.form_rempli).length,
      form_match_by_email: inviteesEnriched.filter((i: any) => i.form_match_method === 'email').length,
      form_match_by_name: inviteesEnriched.filter((i: any) => i.form_match_method === 'nom').length,
      appels_avec: appelsArr.filter((a: any) => a.a_appele).length,
      appels_sans: withTel.filter((a: any) => !a.a_appele).length,
      taux_appel: withTel.length > 0 ? Math.round(100 * appelsArr.filter((a: any) => a.a_appele).length / withTel.length) : 0,
      emails_125: (emails || []).length,
      total_relances_envoyees: (relancesRaw || []).filter((r: any) => r.statut === 'sent').length,
    };

    return new Response(JSON.stringify({
      sessions: sessionsEnriched, invitees: inviteesEnriched, formulaires,
      appels: appelsArr, resumes_appels: [], emails: emails || [],
      kpis, ca_comparaison: caComparaison,
    }), { headers: corsHeaders });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
