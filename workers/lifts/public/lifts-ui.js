import {
  LIFTS,
  WORKOUTS,
  applyCompletedWorkout,
  draftToEntries,
  ensureDraft,
  exportJson,
  firstIncompleteLiftIndex,
  importJson,
  isLiftSuccess,
  loadStore,
  nextWorkoutKind,
  saveStore,
} from "./lifts-domain.js";

const THEME_KEY = "lifts-theme";

let store = createBootStore();
let tab = "workout";
let statusMessage = "";

function createBootStore() {
  return ensureDraft(loadStore());
}

function persist() {
  saveStore(store);
}

function setStatus(msg) {
  statusMessage = msg;
}

function formatWeight(n) {
  if (n === null) return "−";
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function formatDate(iso) {
  if (typeof iso !== "string") return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function currentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#F4F4F6" : "#000000");
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
  } else {
    // OS default: leave data-theme unset so CSS media query applies, but sync meta
    document.documentElement.removeAttribute("data-theme");
    const light = window.matchMedia("(prefers-color-scheme: light)").matches;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", light ? "#F4F4F6" : "#000000");
  }
}

function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  render(document.getElementById("lifts-app"));
}

function themeToggleMarkup() {
  const t = currentTheme();
  const dark = t === "dark" ? "<b>DARK</b>" : "DARK";
  const light = t === "light" ? "<b>LIGHT</b>" : "LIGHT";
  return `${dark} <span aria-hidden="true">/</span> ${light}`;
}

function render(root) {
  store = ensureDraft(store);
  const draft = store.draft;
  const kind = draft.kind;
  const targets = WORKOUTS[kind];
  const focusIdx = firstIncompleteLiftIndex(kind, draft);

  root.innerHTML = `
    <div class="shell">
      <header class="top">
        <div class="brand">LIFTS <span class="mark">5×5</span></div>
        <button type="button" class="tog cap" data-action="theme" aria-label="Toggle color theme">
          ${themeToggleMarkup()}
        </button>
      </header>

      <div class="page-head">
        <p class="cap">Personal tracker · lb</p>
        <p class="sub">Alternating A/B · about 45 min · rest 3–5 min between work sets</p>
      </div>

      <nav class="tabs" role="tablist" aria-label="Tracker views">
        <button type="button" role="tab" class="tab ${tab === "workout" ? "is-active" : ""}" data-tab="workout" aria-selected="${tab === "workout"}">Today</button>
        <button type="button" role="tab" class="tab ${tab === "history" ? "is-active" : ""}" data-tab="history" aria-selected="${tab === "history"}">History</button>
      </nav>

      <div class="status" role="status" aria-live="polite">${escapeHtml(statusMessage)}</div>

      ${tab === "workout" ? renderWorkout(kind, draft, targets, focusIdx) : renderHistory()}
    </div>
  `;

  bind(root);
}

function renderWorkout(kind, draft, targets, focusIdx) {
  const nextLift = targets[focusIdx];
  return `
    <section class="panel" aria-labelledby="workout-heading">
      <div class="sh">
        <h2 id="workout-heading" class="title">Workout ${kind}</h2>
        <span class="meta">NEXT</span>
      </div>
      <div class="banner">
        <p class="next">Next up: <strong>${escapeHtml(LIFTS[nextLift.lift].name)}</strong></p>
      </div>
      <ol class="list">
        ${targets
          .map((t, i) => {
            const entry = draft.entries[t.lift];
            const complete =
              entry.weight !== null && entry.sets.every((r) => r !== null && r !== undefined);
            const success =
              complete &&
              isLiftSuccess(
                { sets: entry.sets.map((r) => r ?? 0) },
                t,
              );
            return `
              <li class="card ${i === focusIdx ? "is-focus" : ""} ${complete ? "is-filled" : ""}" data-lift="${t.lift}">
                <div class="card-head">
                  <h3>${escapeHtml(LIFTS[t.lift].name)}</h3>
                  <span class="scheme">${t.sets}×${t.reps}</span>
                  ${complete ? `<span class="badge ${success ? "ok" : "miss"}">${success ? "Success" : "Miss"}</span>` : ""}
                </div>
                <div class="field">
                  <label for="w-${t.lift}">Weight (lb)</label>
                  <input id="w-${t.lift}" name="weight-${t.lift}" type="number" inputmode="decimal" step="0.5" min="0" enterkeyhint="next"
                    value="${entry.weight ?? ""}" data-lift="${t.lift}" data-field="weight"
                    ${store.progress[t.lift].nextWeight === null ? 'placeholder="Starting weight"' : ""} />
                  ${
                    store.progress[t.lift].nextWeight !== null
                      ? `<p class="help" id="help-w-${t.lift}">Recommended ${formatWeight(store.progress[t.lift].nextWeight)} lb${
                          store.progress[t.lift].consecutiveFailures
                            ? ` · ${store.progress[t.lift].consecutiveFailures} fail${store.progress[t.lift].consecutiveFailures === 1 ? "" : "s"} in a row`
                            : ""
                        }</p>`
                      : `<p class="help" id="help-w-${t.lift}">No history yet. Enter your starting weight.</p>`
                  }
                </div>
                <fieldset class="sets">
                  <legend>Reps per set</legend>
                  <div class="set-grid" style="--cols: ${t.sets}">
                    ${Array.from({ length: t.sets }, (_, s) => `
                      <div class="set">
                        <label for="s-${t.lift}-${s}">Set ${s + 1}</label>
                        <input id="s-${t.lift}-${s}" name="set-${t.lift}-${s}" type="number" inputmode="numeric" min="0" max="20" step="1" enterkeyhint="next"
                          value="${entry.sets[s] ?? ""}" data-lift="${t.lift}" data-field="set" data-set="${s}" />
                      </div>
                    `).join("")}
                  </div>
                </fieldset>
                <div class="field">
                  <label for="n-${t.lift}">Notes <span class="optional">(optional)</span></label>
                  <input id="n-${t.lift}" name="notes-${t.lift}" type="text" enterkeyhint="done"
                    value="${escapeAttr(entry.notes)}" data-lift="${t.lift}" data-field="notes" autocomplete="off" />
                </div>
              </li>
            `;
          })
          .join("")}
      </ol>
      <p class="tip">Tip: rest 3–5 minutes between work sets. No timer here on purpose.</p>
      <button type="button" class="btn-solid" data-action="complete">Mark workout complete</button>
    </section>
  `;
}

function renderHistory() {
  const liftIds = Object.keys(LIFTS);
  const sessions = [...store.sessions].reverse();
  return `
    <section class="panel" aria-labelledby="history-heading">
      <div class="sh">
        <h2 id="history-heading" class="title">Next weights</h2>
        <span class="meta">WORKOUT ${nextWorkoutKind(store)}</span>
      </div>
      <ul class="weight-list">
        ${liftIds
          .map((id) => {
            const p = store.progress[id];
            return `<li><span class="name">${escapeHtml(LIFTS[id].name)}</span><span class="val">${
              p.nextWeight === null
                ? "Not set"
                : `${formatWeight(p.nextWeight)} lb`
            }${p.consecutiveFailures ? ` · ${p.consecutiveFailures} fail streak` : ""}</span></li>`;
          })
          .join("")}
      </ul>

      <div class="sh">
        <h2 class="title">Sessions</h2>
        <span class="meta">${sessions.length}</span>
      </div>
      ${
        sessions.length === 0
          ? `<p class="help">No sessions logged yet.</p>`
          : `<ol class="history">
              ${sessions
                .slice(0, 30)
                .map((s) => {
                  const lines = s.lifts
                    .map((l) => {
                      const target = WORKOUTS[s.kind].find((t) => t.lift === l.lift);
                      const ok = isLiftSuccess(l, target);
                      return `${LIFTS[l.lift].name} ${formatWeight(l.weight)} × ${l.sets.join("/")}${ok ? "" : " (miss)"}`;
                    })
                    .join(" · ");
                  return `<li><div class="hist-top"><strong>Workout ${escapeHtml(s.kind)}</strong><time datetime="${escapeAttr(s.completedAt)}">${escapeHtml(formatDate(s.completedAt))}</time></div><p>${escapeHtml(lines)}</p></li>`;
                })
                .join("")}
            </ol>`
      }

      <div class="sh" style="margin-top:28px">
        <h2 class="title">Backup</h2>
      </div>
      <p class="help">Data stays in this browser only. Export before clearing site data.</p>
      <div class="backup">
        <button type="button" class="btn-outline" data-action="export">Export JSON</button>
        <label class="btn-outline file-label">
          Import JSON
          <input type="file" accept="application/json,.json" data-action="import" class="visually-hidden" />
        </label>
      </div>
    </section>
  `;
}

function bind(root) {
  root.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tab = btn.dataset.tab;
      setStatus("");
      render(root);
    });
  });

  root.querySelector('[data-action="theme"]')?.addEventListener("click", () => {
    toggleTheme();
  });

  root.querySelectorAll("input[data-lift]").forEach((input) => {
    const sync = () => {
      const lift = input.dataset.lift;
      const field = input.dataset.field;
      store = ensureDraft(store);
      const draft = store.draft;
      const entry = draft.entries[lift];
      if (field === "weight") {
        const v = input.value.trim();
        entry.weight = v === "" ? null : Number(v);
      } else if (field === "set") {
        const idx = Number(input.dataset.set);
        const v = input.value.trim();
        entry.sets[idx] = v === "" ? null : Number(v);
      } else if (field === "notes") {
        entry.notes = input.value;
      }
      draft.entries[lift] = entry;
      store = { ...store, draft };
      persist();
    };
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
  });

  root.querySelector('[data-action="complete"]')?.addEventListener("click", () => {
    store = ensureDraft(store);
    const draft = store.draft;
    const parsed = draftToEntries(draft.kind, draft);
    if (!parsed.ok) {
      setStatus(parsed.message);
      render(root);
      return;
    }
    store = applyCompletedWorkout(store, draft.kind, parsed.lifts);
    store = ensureDraft(store);
    persist();
    setStatus(`Workout ${draft.kind} saved. Next up: Workout ${store.draft.kind}.`);
    tab = "workout";
    render(root);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  root.querySelector('[data-action="export"]')?.addEventListener("click", () => {
    const blob = new Blob([exportJson(store)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stronglifts-5x5-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Exported backup JSON.");
    render(root);
  });

  root.querySelector('[data-action="import"]')?.addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      store = ensureDraft(importJson(text));
      persist();
      setStatus("Imported backup. Draft reset to next workout.");
      tab = "history";
      render(root);
    } catch {
      setStatus("Import failed. Use a JSON file exported from this tracker.");
      render(root);
    }
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll("'", "&#39;");
}

export function mountLiftsTracker(root) {
  initTheme();
  store = createBootStore();
  persist();
  render(root);
}
