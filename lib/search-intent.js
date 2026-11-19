const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "au", "aux", "et", "ou", "en", "sur", "dans",
  "pour", "par", "avec", "sans", "est", "sont", "pas", "ne", "plus", "trop", "très", "bien", "mal",
  "que", "qui", "quoi", "comme", "aussi", "mon", "ma", "mes", "notre", "chez", "lors", "depuis",
  "marche", "fonctionne", "issue", "help", "urgent",
]);

const DOMAIN_EXPANSIONS = {
  vpn: ["vpn", "sslvpn", "pulse", "globalprotect", "forticlient", "anyconnect", "distant", "télétravail"],
  outlook: ["outlook", "exchange", "messagerie", "courriel", "email", "owa"],
  wifi: ["wifi", "wi-fi", "sans fil", "wlan", "ssid"],
  imprimante: ["imprimante", "printer", "cups", "print"],
  "mot de passe": ["mot de passe", "mdp", "password", "réinitialisation", "reset", "verrouillage", "lockout"],
  teams: ["teams", "microsoft teams", "réunion", "audio"],
  sharepoint: ["sharepoint", "onedrive", "fichier", "accès"],
  snow: ["servicenow", "snow", "incident", "ticket"],
};

function normalizeToken(w) {
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#_-]/g, "");
}

function tokenize(text) {
  if (!text?.trim()) return [];
  return text
    .split(/[\s,;|/\\()[\]{}:]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1);
}

function expandDomain(tokens) {
  const blob = tokens.join(" ").toLowerCase();
  const extra = [];
  for (const [needle, synonyms] of Object.entries(DOMAIN_EXPANSIONS)) {
    const parts = needle.split(/\s+/).map(normalizeToken);
    if (parts.every((p) => blob.includes(p)) || parts.some((p) => tokens.map(normalizeToken).includes(p))) {
      extra.push(...synonyms);
    }
  }
  return extra;
}

export function buildLocalSearchIntent(incident) {
  const title = (incident?.title || "").trim();
  const description = (incident?.description || "").trim();
  const extra = (incident?.extra || "").trim();
  const combined = [title, description, extra].filter(Boolean).join("\n");
  const rawQuery = title || description.slice(0, 120);

  const tokens = tokenize(combined).filter((w) => {
    const n = normalizeToken(w);
    return n.length > 2 && !STOPWORDS.has(n);
  });

  const codes = [...combined.matchAll(/\b[A-Z]{2,}-\d+\b|\bINC\d+\b|\bERR[_\s]?\d+\b|\b0x[0-9A-Fa-f]+\b/g)].map((m) => m[0]);
  const fromTitle = tokenize(title).filter((w) => normalizeToken(w).length > 2 && !STOPWORDS.has(normalizeToken(w)));
  const expanded = expandDomain([...tokens, ...fromTitle]);

  const terms = [];
  const push = (t) => {
    const s = (t || "").trim().slice(0, 60);
    if (!s || s.length < 2) return;
    const key = normalizeToken(s);
    if (!key || key.length < 2) return;
    if (terms.some((x) => normalizeToken(x) === key)) return;
    terms.push(s);
  };

  if (title) push(title.slice(0, 80));
  for (const t of fromTitle) push(t);
  for (const t of tokens.slice(0, 12)) push(t);
  for (const t of expanded) push(t);
  for (const c of codes) push(c);

  const keywords = terms.filter((t) => t.length <= 24 && !t.includes(" "));
  const displayTerms = terms.slice(0, 10);
  const topic = fromTitle.slice(0, 3).join(", ") || keywords.slice(0, 3).join(", ") || rawQuery.slice(0, 60);
  const summary = topic
    ? `Incident perçu comme : ${topic}.`
    : "Saisie trop courte — précisez le service ou le symptôme.";

  return {
    rawQuery,
    summary,
    terms: displayTerms.length ? displayTerms : rawQuery ? [rawQuery.slice(0, 40)] : [],
    method: "local",
  };
}

export function normalizeTokenExport(w) {
  return normalizeToken(w);
}