import { SUPABASE_URL, SUPABASE_ANON_KEY, EVENTS_TABLE } from "../config.js";

/** Événements plateforme → Grafana via Supabase (non bloquant). */
export function logEvent(event) {
  const table = (EVENTS_TABLE || "bragatest_events").trim();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !table) return;

  const payload = {
    event_type: event.eventType,
    source: event.source ?? null,
    success: event.success !== false,
    duration_ms: event.durationMs ?? null,
    kb_count: event.kbCount ?? null,
    error_message: event.errorMessage ? String(event.errorMessage).slice(0, 500) : null,
    metadata: event.metadata ?? {},
  };

  const url = `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${encodeURIComponent(table)}`;
  fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}