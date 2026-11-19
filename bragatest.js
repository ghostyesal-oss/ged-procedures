import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, TABLE } from "./config.js";
import { buildLocalSearchIntent, normalizeTokenExport } from "./lib/search-intent.js";

const $ = (id) => document.getElementById(id);
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let rankedRows = [];
let selectedId = null;

function stripHtml(html = "") {
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent || d.innerText || "").trim();
}

function escapeHtml(s = "") {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(text, isError = false) {
  const el = $("status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function rowHaystack(row) {
  return [
    row.titre,
    row.application,
    row.categorie,
    stripHtml(row.description),
    stripHtml(row.solution),
  ]
    .join(" ")
    .toLowerCase();
}

function scoreRow(row, terms) {
  const hay = rowHaystack(row);
  let score = 0;
  const rawQuery = terms.join(" ").toLowerCase();

  if (rawQuery.length > 4 && hay.includes(rawQuery)) score += 40;

  for (const term of terms) {
    const n = normalizeTokenExport(term);
    if (!n || n.length < 2) continue;
    if (hay.includes(term.toLowerCase())) score += 12;
    if (hay.includes(n)) score += 8;
    if ((row.titre || "").toLowerCase().includes(n)) score += 15;
    if ((row.application || "").toLowerCase().includes(n)) score += 10;
  }
  return score;
}

function rankRows(incident) {
  const assist = buildLocalSearchIntent(incident);
  const terms = assist.terms.length ? assist.terms : [assist.rawQuery].filter(Boolean);
  const scored = allRows
    .map((row) => ({ row, score: scoreRow(row, terms) }))
    .filter((x) => x.score > 0)
  scored.sort((a, b) => b.score - a.score);
  return { assist, ranked: scored, terms };
}

function showSearchIntent(assist) {
  const box = $("search-intent");
  if (!assist?.summary && !assist?.terms?.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  const terms = (assist.terms || [])
    .slice(0, 8)
    .map((t) => `<span class="search-term-chip">${escapeHtml(t)}</span>`)
    .join("");
  box.innerHTML = `<p class="search-intent-label"><strong>Intermédiaire (règles)</strong> — ${escapeHtml(assist.summary || "")}</p>${terms ? `<div class="search-term-row">${terms}</div>` : ""}`;
  box.classList.remove("hidden");
}

function showKbList(ranked) {
  const wrap = $("kb-wrap");
  const list = $("kb-list");
  list.innerHTML = "";
  if (!ranked.length) {
    wrap.classList.add("hidden");
    return;
  }
  for (const { row, score } of ranked.slice(0, 8)) {
    const li = document.createElement("li");
    li.dataset.id = String(row.id);
    const app = row.application ? ` · ${row.application}` : "";
    li.innerHTML = `<div><strong>${escapeHtml(row.titre || "(sans titre)")}</strong></div><div class="kb-meta">${escapeHtml(row.categorie || "")}${escapeHtml(app)} · score ${score}</div>`;
    if (selectedId === row.id) li.classList.add("active");
    li.addEventListener("click", () => {
      selectedId = row.id;
      showKbList(rankedRows);
      renderProcedure(row, "database");
    });
    list.appendChild(li);
  }
  wrap.classList.remove("hidden");
}

function renderProcedure(row, source) {
  const wrap = $("result-wrap");
  const box = $("result");
  const badge = $("source-badge");

  if (!row) {
    wrap.classList.add("hidden");
    badge.textContent = "Rien en base";
    badge.className = "source-badge source-none";
    return;
  }

  const appLine = row.application ? ` · ${escapeHtml(row.application)}` : "";
  box.innerHTML = `
    <div class="procedure-doc">
      <div class="procedure-head-meta">${escapeHtml(row.categorie || "")}${appLine}</div>
      <h3 class="procedure-head-title">${escapeHtml(row.titre || "")}</h3>
      <section class="procedure-block">
        <div class="procedure-block__head"><h4 class="procedure-block__title">Description</h4></div>
        <div class="procedure-block__body">${row.description || "<p><em>—</em></p>"}</div>
      </section>
      <section class="procedure-block procedure-block--solution">
        <div class="procedure-block__head"><h4 class="procedure-block__title">Solution</h4></div>
        <div class="procedure-block__body">${row.solution || "<p><em>—</em></p>"}</div>
      </section>
      <p style="margin:8px 0 0;font-size:0.72rem;color:var(--muted)">
        <a href="index.html" style="color:var(--accent)">Ouvrir dans GED</a> pour modifier
      </p>
    </div>
  `;

  badge.textContent = source === "database" ? "Base GED (Supabase)" : "—";
  badge.className = "source-badge source-db";
  wrap.classList.remove("hidden");
  $("input-panel")?.classList.add("compact");
  $("result-panel")?.classList.remove("hidden");
  wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function loadGed() {
  $("conn-status").textContent = "Connexion…";
  const { data, error } = await sb.from(TABLE).select("*").order("updated_at", { ascending: false });
  if (error) {
    $("conn-status").textContent = "Erreur";
    setStatus("Erreur GED : " + error.message, true);
    return;
  }
  allRows = data || [];
  $("conn-status").textContent = `GED · ${allRows.length} proc.`;
  setStatus(`${allRows.length} procédure(s) chargée(s) depuis ged_items.`);
}

async function analyze() {
  const title = ($("title")?.value || "").trim();
  const description = ($("description")?.value || "").trim();
  const extra = ($("extra")?.value || "").trim();

  if (!title && !description) {
    setStatus("Saisissez un résumé ou une description.", true);
    return;
  }

  $("result-loading")?.classList.remove("hidden");
  $("kb-wrap")?.classList.add("hidden");
  $("result-wrap")?.classList.add("hidden");
  setStatus("Recherche en base GED…");

  await new Promise((r) => setTimeout(r, 120));

  const incident = { title, description, extra };
  const { assist, ranked } = rankRows(incident);
  rankedRows = ranked.map((x) => x);

  showSearchIntent(assist);
  $("result-loading")?.classList.add("hidden");
  $("result-panel")?.classList.remove("hidden");

  if (!ranked.length) {
    selectedId = null;
    showKbList([]);
    renderProcedure(null);
    setStatus("Aucune procédure correspondante — enrichissez la GED ou affinez la saisie.");
    return;
  }

  selectedId = ranked[0].row.id;
  showKbList(ranked);
  renderProcedure(ranked[0].row, "database");
  setStatus(`${ranked.length} correspondance(s). Meilleure : « ${ranked[0].row.titre} ».`);
}

function wireUi() {
  $("analyze")?.addEventListener("click", () => analyze());
  $("toggle-input")?.addEventListener("click", () => {
    $("input-panel")?.classList.toggle("compact");
    $("toggle-input").textContent = $("input-panel")?.classList.contains("compact") ? "Développer" : "Réduire";
  });
  $("clear-fields")?.addEventListener("click", () => {
    $("title").value = "";
    $("description").value = "";
    $("extra").value = "";
    $("input-panel")?.classList.remove("compact");
    setStatus("");
  });
  $("copy")?.addEventListener("click", async () => {
    const row = allRows.find((x) => x.id === selectedId);
    if (!row) return;
    const text = [
      row.titre,
      "",
      "Description",
      stripHtml(row.description),
      "",
      "Solution",
      stripHtml(row.solution),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Procédure copiée dans le presse-papiers.");
    } catch {
      setStatus("Copie impossible sur ce navigateur.", true);
    }
  });
}

wireUi();
await loadGed();