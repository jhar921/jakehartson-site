import {
  LIFTS,
  STORAGE_KEY,
  WORKOUTS,
  allLiftsConfirmed,
  applySetCheck,
  draftToEntries,
  ensureDraft,
  exportJson,
  firstIncompleteLiftIndex,
  formatLbs,
  formatPlatePlanPlain,
  formatScheme,
  formatSetsAtWeight,
  isLiftSuccess,
  needsStartingWeights,
  nextWorkoutKind,
  platePlan,
  prescriptionWhy,
  sessionDate,
  setChecksOf,
  warmupChecksOf,
  warmupSets,
} from "./lifts-domain.js";

const THEME_KEY = "lifts-theme";

let store = null;
let tab = "workout";
let statusMessage = "";
let localImportDone = true;
let localBackupRaw = null;
let startingForm = { squat: "", bench: "", row: "", ohp: "", deadlift: "" };
let settingsForm = null;
let bootError = "";
let draftTimer = 0;
// Lift whose box just got its saved outline (animates once, then stays static).
let justSavedLift = null;
// The workout saved today. Shown read-only (locked) until the lifter opens the next one.
let lockedSession = null;
let statusTone = "warn";
// Lift ids whose warm-up section the lifter opened (kept across re-renders).
const openWarmups = new Set();

const CHECK_SVG = `<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 6.4 4.7 9 10 3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>`;
const LOCK_SVG = `<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><rect x="2.5" y="5.5" width="7" height="5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;

function todayLA() {
  return sessionDate(new Date().toISOString());
}

function setStatus(msg, tone = "warn") {
  statusMessage = msg;
  statusTone = tone;
}

function formatWeight(n) {
  if (n === null || n === undefined) return "";
  return formatLbs(n);
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

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function applyPayload(payload) {
  store = payload.store;
  if (typeof payload.localImportDone === "boolean") localImportDone = payload.localImportDone;
}

async function persistDraftSoon() {
  clearTimeout(draftTimer);
  draftTimer = window.setTimeout(() => {
    persistDraft().catch((err) => {
      setStatus(err.message);
      render(document.getElementById("lifts-app"));
    });
  }, 300);
}

async function persistDraft() {
  if (!store?.draft) return;
  const payload = await api("/api/draft", { method: "PUT", body: JSON.stringify({ draft: store.draft }) });
  applyPayload(payload);
}

function peekLocalBackup() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (parsed.version !== 1 && parsed.version !== 2)) return null;
    if (!Array.isArray(parsed.sessions)) return null;
    return raw;
  } catch {
    return null;
  }
}

function render(root) {
  if (bootError) {
    root.innerHTML = `
      <div class="shell">
        <header class="top">
          <div class="brand">LIFTS <span class="mark">5×5</span></div>
        </header>
        <p class="status" role="alert">${escapeHtml(bootError)}</p>
      </div>`;
    return;
  }
  if (!store) {
    root.innerHTML = `<div class="shell"><p class="boot">Loading tracker…</p></div>`;
    return;
  }

  store = ensureDraft(store);
  const showImport = !localImportDone && !!localBackupRaw;
  const firstRun = needsStartingWeights(store);

  root.innerHTML = `
    <div class="shell">
      <header class="top">
        <div class="brand">LIFTS <span class="mark">5×5</span></div>
        <button type="button" class="tog cap" data-action="theme" aria-label="Toggle color theme">
          ${themeToggleMarkup()}
        </button>
      </header>

      ${
        showImport
          ? `<div class="banner notice" role="region" aria-labelledby="import-heading">
              <h2 id="import-heading" class="title">Browser history found</h2>
              <p class="help">Adds sessions from this browser to the server. Your server weights and today's lifts are kept. The browser copy stays too.</p>
              <div class="backup">
                <button type="button" class="btn-solid" data-action="import-local">Add to server</button>
                <button type="button" class="btn-outline" data-action="import-later">Not now</button>
              </div>
            </div>`
          : ""
      }

      <nav class="tabs" role="tablist" aria-label="Tracker views">
        <button type="button" role="tab" class="tab ${tab === "workout" ? "is-active" : ""}" data-tab="workout" aria-selected="${tab === "workout"}">Today</button>
        <button type="button" role="tab" class="tab ${tab === "history" ? "is-active" : ""}" data-tab="history" aria-selected="${tab === "history"}">History</button>
        <button type="button" role="tab" class="tab ${tab === "settings" ? "is-active" : ""}" data-tab="settings" aria-selected="${tab === "settings"}">Settings</button>
      </nav>

      <div class="status ${statusTone === "ok" ? "is-ok" : ""}" role="status" aria-live="polite">${escapeHtml(statusMessage)}</div>

      ${
        tab === "workout"
          ? firstRun
            ? renderStarting()
            : lockedSession
              ? renderLocked(lockedSession)
              : renderWorkout()
          : tab === "history"
            ? renderHistory()
            : renderSettings()
      }
    </div>
  `;

  bind(root);
}

function renderStarting() {
  const fields = Object.keys(LIFTS)
    .map((id) => {
      return `<div class="field">
        <label for="start-${id}">${escapeHtml(LIFTS[id].name)} (lb)</label>
        <input id="start-${id}" name="start-${id}" type="number" inputmode="decimal" step="0.5" min="0" required
          value="${escapeAttr(startingForm[id] ?? "")}" data-start="${id}" />
      </div>`;
    })
    .join("");
  return `
    <section class="panel" aria-labelledby="start-heading">
      <div class="sh">
        <h2 id="start-heading" class="title">Set starting weights</h2>
      </div>
      <p class="help">The app does not invent a start weight. Enter the work weight you will use on your first session for each lift.</p>
      ${fields}
      <button type="button" class="btn-solid" data-action="save-start">Save starting weights</button>
    </section>
  `;
}

function renderWarmup(target, wu, checks, open) {
  return `
    <details class="wu-block" data-lift="${target.lift}" ${open ? "open" : ""}>
      <summary>
        <span class="wu-summary">Warm-up (optional)</span>
      </summary>
      <ul class="wu-list">
        ${wu
          .map((s, i) => {
            return `<li>
              <label class="wu-row" for="wu-${target.lift}-${i}">
                <input id="wu-${target.lift}-${i}" name="warmup-${target.lift}-${i}" type="checkbox"
                  data-lift="${target.lift}" data-field="warmup-check" data-set="${i}" ${checks[i] ? "checked" : ""}>
                <span>${formatWeight(s.weight)} lb × ${s.reps} reps</span>
              </label>
            </li>`;
          })
          .join("")}
      </ul>
    </details>
  `;
}

function renderWorkSets(target, entry, checks, weight, locked) {
  const disabled = locked ? "disabled" : "";
  const shownWeight = weight ?? "";
  return `
    <fieldset class="work-sets">
      <legend>Working sets</legend>
      <ol class="work-set-list">
        ${Array.from({ length: target.sets }, (_, s) => {
          const reps = entry.sets[s];
          const shownReps = reps === null || reps === undefined ? target.reps : reps;
          return `
            <li class="work-set ${checks[s] ? "is-done" : ""}">
              <p class="set-name" id="set-name-${target.lift}-${s}">Set ${s + 1}</p>
              <div class="set-row">
                <div class="set-qty">
                  <label class="visually-hidden" for="w-${target.lift}-${s}">Weight for set ${s + 1}, pounds</label>
                  <input id="w-${target.lift}-${s}" name="weight-${target.lift}-${s}" type="number" inputmode="decimal" step="0.5" min="0" enterkeyhint="next"
                    value="${shownWeight}" data-lift="${target.lift}" data-field="weight" ${disabled} autocomplete="off">
                  <span class="set-unit" aria-hidden="true">lb</span>
                </div>
                <span class="set-times" aria-hidden="true">×</span>
                <div class="set-qty">
                  <label class="visually-hidden" for="s-${target.lift}-${s}">Reps for set ${s + 1}</label>
                  <input id="s-${target.lift}-${s}" name="set-${target.lift}-${s}" type="number" inputmode="numeric" min="0" max="20" step="1" enterkeyhint="next"
                    value="${shownReps}" data-lift="${target.lift}" data-field="set" data-set="${s}" ${disabled} autocomplete="off">
                  <span class="set-unit" aria-hidden="true">reps</span>
                </div>
                <label class="set-check" for="c-${target.lift}-${s}">
                  <input id="c-${target.lift}-${s}" name="check-${target.lift}-${s}" type="checkbox"
                    data-lift="${target.lift}" data-field="check" data-set="${s}"
                    ${checks[s] ? "checked" : ""} ${disabled}
                    aria-describedby="set-name-${target.lift}-${s}">
                  <span>I did it</span>
                </label>
              </div>
            </li>`;
        }).join("")}
      </ol>
    </fieldset>
  `;
}

function syncWeightDisplay(root, lift, rawWeight) {
  const card = root.querySelector(`.card[data-lift="${lift}"]`);
  if (!card || !store) return;
  const prescribed = store.progress[lift].nextWeight;
  const parsed = rawWeight === "" || rawWeight == null ? null : Number(rawWeight);
  const shown = parsed == null || !Number.isFinite(parsed) ? prescribed : parsed;
  const rx = card.querySelector(".rx-weight");
  if (rx) {
    rx.innerHTML = `${escapeHtml(formatWeight(shown))} <span class="unit">LB</span>`;
    rx.setAttribute("aria-label", `Working weight ${formatWeight(shown)} pounds`);
  }
  card.querySelectorAll(`input[data-field="weight"]`).forEach((el) => {
    if (document.activeElement !== el) el.value = rawWeight ?? "";
  });
  const settings = store.settings;
  const plates = shown == null ? null : platePlan(shown, settings.barWeightLbs, settings.plates);
  const plateEl = card.querySelector(".plates");
  if (plateEl && plates) {
    plateEl.textContent = formatPlatePlanPlain(plates, settings.barWeightLbs);
    plateEl.classList.toggle("is-flag", !!plates.flagged);
  }
  let help = card.querySelector(".rx-prescribed");
  if (shown != null && prescribed != null && Number(shown) !== prescribed) {
    if (!help) {
      help = document.createElement("p");
      help.className = "help rx-prescribed";
      rx?.after(help);
    }
    help.textContent = `Prescribed ${formatWeight(prescribed)} lb`;
  } else if (help) {
    help.remove();
  }
}

function renderWorkout() {
  const draft = store.draft;
  const kind = draft.kind;
  const targets = WORKOUTS[kind];
  const focusIdx = firstIncompleteLiftIndex(kind, draft);
  const settings = store.settings;
  const ready = allLiftsConfirmed(kind, draft);
  return `
    <section class="panel" aria-labelledby="workout-heading">
      <div class="sh">
        <h2 id="workout-heading" class="title">Workout ${kind}</h2>
        <span class="meta">TODAY · about 45 min</span>
      </div>
      <ol class="list">
        ${targets
          .map((t, i) => {
            const entry = draft.entries[t.lift];
            const prescribed = store.progress[t.lift].nextWeight;
            const complete = !!entry.confirmed;
            const workWeight = entry.weight ?? prescribed;
            const logged = complete ? { weight: entry.weight, sets: entry.sets.map((r) => r ?? 0) } : null;
            const success = logged && isLiftSuccess(logged, t);
            const why = prescriptionWhy(store, t.lift);
            const wu = workWeight == null ? [] : warmupSets(t.lift, workWeight, settings.barWeightLbs, settings.plates);
            const plates = workWeight == null ? null : platePlan(workWeight, settings.barWeightLbs, settings.plates);
            const checks = setChecksOf(entry, t);
            const wuChecks = warmupChecksOf(entry, wu.length);
            const wuOpen = wuChecks.some(Boolean) || openWarmups.has(t.lift);
            const displayWeight = workWeight;
            const showPrescribed = displayWeight != null && prescribed != null && displayWeight !== prescribed;
            return `
              <li class="card ${i === focusIdx && !complete ? "is-focus" : ""} ${complete ? "is-filled is-saved" : ""} ${complete && justSavedLift === t.lift ? "just-saved" : ""}" data-lift="${t.lift}">
                <div class="card-head">
                  <h3>${escapeHtml(LIFTS[t.lift].name)}</h3>
                  <span class="scheme">${escapeHtml(formatScheme(t))}</span>
                  ${complete ? `<span class="badge ${success ? "ok" : "miss"}">${success ? "Hit" : "Miss"}</span>` : ""}
                  ${complete ? `<span class="saved-mark">${CHECK_SVG}Saved</span>` : ""}
                </div>
                <p class="rx-weight mono" aria-label="Working weight ${formatWeight(displayWeight)} pounds">${formatWeight(displayWeight)} <span class="unit">LB</span></p>
                ${showPrescribed ? `<p class="help rx-prescribed">Prescribed ${formatWeight(prescribed)} lb</p>` : ""}
                <p class="why">${escapeHtml(why)}</p>
                ${plates ? `<p class="plates ${plates.flagged ? "is-flag" : ""}">${escapeHtml(formatPlatePlanPlain(plates, settings.barWeightLbs))}</p>` : ""}
                ${wu.length ? renderWarmup(t, wu, wuChecks, wuOpen) : ""}
                ${renderWorkSets(t, entry, checks, displayWeight, false)}
                <div class="field">
                  <label for="n-${t.lift}">Notes <span class="optional">(optional)</span></label>
                  <input id="n-${t.lift}" name="notes-${t.lift}" type="text" enterkeyhint="done"
                    value="${escapeAttr(entry.notes ?? "")}" data-lift="${t.lift}" data-field="notes" autocomplete="off" />
                </div>
              </li>
            `;
          })
          .join("")}
      </ol>
      <p class="tip">Rest 3 to 5 min between work sets. No timer here on purpose.</p>
      <button type="button" class="btn-solid" data-action="complete" ${ready ? "" : "disabled"}>${ready ? "Save workout" : "Finish each lift to save"}</button>
    </section>
  `;
}

function renderLocked(session) {
  const nextKind = session.kind === "A" ? "B" : "A";
  return `
    <section class="panel" aria-labelledby="locked-heading">
      <div class="sh">
        <h2 id="locked-heading" class="title">Workout ${escapeHtml(session.kind)} · saved</h2>
        <span class="lock-mark">${LOCK_SVG}Locked</span>
      </div>
      <ol class="list">
        ${session.lifts
          .map((l) => {
            const target = WORKOUTS[session.kind].find((t) => t.lift === l.lift);
            const ok = isLiftSuccess(l, target);
            const entry = { weight: l.weight, sets: l.sets, notes: l.notes ?? "", confirmed: true };
            const checks = setChecksOf(entry, target);
            const settings = store.settings;
            const plates = platePlan(l.weight, settings.barWeightLbs, settings.plates);
            const showPrescribed = l.prescribedWeight != null && l.prescribedWeight !== l.weight;
            return `
              <li class="card is-locked" data-lift="${l.lift}" aria-readonly="true">
                <div class="card-head">
                  <h3>${escapeHtml(LIFTS[l.lift].name)}</h3>
                  <span class="scheme">${escapeHtml(formatScheme(target))}</span>
                  <span class="badge ${ok ? "ok" : "miss"}">${ok ? "Hit" : "Miss"}</span>
                </div>
                <p class="rx-weight mono" aria-label="Logged weight ${formatWeight(l.weight)} pounds">${formatWeight(l.weight)} <span class="unit">LB</span></p>
                ${showPrescribed ? `<p class="help rx-prescribed">Prescribed ${formatWeight(l.prescribedWeight)} lb</p>` : ""}
                <p class="help">Logged ${escapeHtml(formatSetsAtWeight(l.sets, l.weight))}${l.notes ? ` · ${escapeHtml(l.notes)}` : ""}</p>
                ${plates ? `<p class="plates ${plates.flagged ? "is-flag" : ""}">${escapeHtml(formatPlatePlanPlain(plates, settings.barWeightLbs))}</p>` : ""}
                ${renderWorkSets(target, entry, checks, l.weight, true)}
              </li>`;
          })
          .join("")}
      </ol>
      <p class="tip">Saved workouts are final. Next up is Workout ${nextKind}.</p>
      <button type="button" class="btn-outline btn-wide" data-action="open-next">Open Workout ${nextKind}</button>
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
              p.nextWeight === null ? "Not set" : `${formatWeight(p.nextWeight)} lb`
            }${p.consecutiveFailures ? ` · ${p.consecutiveFailures} miss streak` : ""}</span></li>`;
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
                      const rx =
                        l.prescribedWeight != null && l.prescribedWeight !== l.weight
                          ? ` (did ${formatWeight(l.weight)})`
                          : "";
                      return `${LIFTS[l.lift].name} ${formatWeight(l.prescribedWeight ?? l.weight)}${rx} × ${l.sets.join("/")}${ok ? "" : " (miss)"}`;
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
      <p class="help">Workouts are stored on the server behind Access. Keep an export in case you need a copy.</p>
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

function renderSettings() {
  const form = settingsForm ?? {
    barWeightLbs: store.settings.barWeightLbs,
    plates: store.settings.plates.join(", "),
  };
  return `
    <section class="panel" aria-labelledby="settings-heading">
      <div class="sh">
        <h2 id="settings-heading" class="title">Bar and plates</h2>
      </div>
      <div class="field">
        <label for="bar-weight">Bar (lb)</label>
        <input id="bar-weight" name="bar" type="number" inputmode="decimal" step="0.5" min="0" value="${escapeAttr(form.barWeightLbs)}" data-settings="bar" />
      </div>
      <div class="field">
        <label for="plates">Plates each side (lb)</label>
        <input id="plates" name="plates" type="text" value="${escapeAttr(form.plates)}" data-settings="plates" autocomplete="off" />
        <p class="help">Default commercial set is 45, 35, 25, 10, 5, 2.5. Add 1.25 if you have them. 2.5 lb jumps need 1.25s each side.</p>
      </div>
      <button type="button" class="btn-solid" data-action="save-settings">Save settings</button>
    </section>
  `;
}

function bind(root) {
  root.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tab = btn.dataset.tab;
      setStatus("");
      settingsForm = null;
      render(root);
    });
  });

  root.querySelector('[data-action="theme"]')?.addEventListener("click", () => {
    toggleTheme();
  });

  root.querySelectorAll("input[data-start]").forEach((input) => {
    input.addEventListener("input", () => {
      startingForm[input.dataset.start] = input.value;
    });
  });

  root.querySelectorAll("input[data-settings]").forEach((input) => {
    input.addEventListener("input", () => {
      settingsForm = settingsForm ?? {
        barWeightLbs: store.settings.barWeightLbs,
        plates: store.settings.plates.join(", "),
      };
      if (input.dataset.settings === "bar") settingsForm.barWeightLbs = input.value;
      if (input.dataset.settings === "plates") settingsForm.plates = input.value;
    });
  });

  root.querySelectorAll("input[data-lift]").forEach((input) => {
    const field = input.dataset.field;
    if (field === "check" || field === "warmup-check") return;
    const sync = () => {
      store = ensureDraft(store);
      const entry = store.draft.entries[input.dataset.lift];
      if (field === "weight") {
        const v = input.value.trim();
        entry.weight = v === "" ? null : Number(v);
        syncWeightDisplay(root, input.dataset.lift, v);
      } else if (field === "set") {
        const idx = Number(input.dataset.set);
        const v = input.value.trim();
        entry.sets[idx] = v === "" ? null : Number(v);
      } else if (field === "notes") {
        entry.notes = input.value;
      }
      store = { ...store, draft: store.draft };
      persistDraftSoon();
    };
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
    if (field === "set") {
      input.addEventListener("blur", () => {
        if (input.disabled) return;
        if (input.value.trim() !== "") return;
        store = ensureDraft(store);
        const lift = input.dataset.lift;
        const target = WORKOUTS[store.draft.kind].find((t) => t.lift === lift);
        const idx = Number(input.dataset.set);
        const entry = store.draft.entries[lift];
        input.value = String(target.reps);
        entry.sets[idx] = target.reps;
        store = { ...store, draft: store.draft };
        persistDraftSoon();
      });
    }
  });

  root.querySelectorAll('input[data-field="check"]').forEach((input) => {
    input.addEventListener("change", async () => {
      if (input.disabled) return;
      const lift = input.dataset.lift;
      const idx = Number(input.dataset.set);
      store = ensureDraft(store);
      const target = WORKOUTS[store.draft.kind].find((t) => t.lift === lift);
      const prescribed = store.progress[lift].nextWeight;
      const wasConfirmed = !!store.draft.entries[lift].confirmed;
      const next = applySetCheck(store.draft.entries[lift], target, prescribed, idx, input.checked);
      if (input.checked && (next.weight === null || !Number.isFinite(next.weight) || next.weight <= 0)) {
        input.checked = false;
        setStatus(`Enter a weight for ${LIFTS[lift].name}.`);
        render(root);
        root.querySelector(`#w-${lift}-${idx}`)?.focus();
        return;
      }
      store.draft.entries[lift] = { ...next, prescribedWeight: prescribed };
      try {
        if (store.draft.entries[lift].confirmed && !wasConfirmed) {
          await persistDraft();
          markSaved(root, lift);
        } else {
          await persistDraft();
          if (!store.draft.entries[lift].confirmed) setStatus("");
          render(root);
        }
      } catch (err) {
        setStatus(err.message);
        render(root);
      }
    });
  });

  root.querySelectorAll('input[data-field="warmup-check"]').forEach((input) => {
    input.addEventListener("change", () => {
      store = ensureDraft(store);
      const lift = input.dataset.lift;
      const entry = store.draft.entries[lift];
      const settings = store.settings;
      const workWeight = entry.weight ?? store.progress[lift].nextWeight;
      const wu = workWeight == null ? [] : warmupSets(lift, workWeight, settings.barWeightLbs, settings.plates);
      const checks = warmupChecksOf(entry, wu.length);
      checks[Number(input.dataset.set)] = input.checked;
      entry.warmupChecked = checks;
      store = { ...store, draft: store.draft };
      persistDraftSoon();
    });
  });

  root.querySelectorAll("details.wu-block").forEach((el) => {
    el.addEventListener("toggle", () => {
      const lift = el.dataset.lift;
      if (el.open) openWarmups.add(lift);
      else openWarmups.delete(lift);
    });
  });

  root.querySelector('[data-action="save-start"]')?.addEventListener("click", async () => {
    const weights = {};
    for (const id of Object.keys(LIFTS)) {
      const v = startingForm[id];
      weights[id] = v === "" ? null : Number(v);
    }
    try {
      const payload = await api("/api/starting-weights", { method: "POST", body: JSON.stringify({ weights }) });
      applyPayload(payload);
      setStatus("Starting weights saved.");
      render(root);
    } catch (err) {
      setStatus(err.message);
      render(root);
    }
  });

  root.querySelector('[data-action="save-settings"]')?.addEventListener("click", async () => {
    const form = settingsForm ?? {
      barWeightLbs: store.settings.barWeightLbs,
      plates: store.settings.plates.join(", "),
    };
    const plates = String(form.plates)
      .split(/[,\s]+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map(Number);
    try {
      const payload = await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ barWeightLbs: Number(form.barWeightLbs), plates }),
      });
      applyPayload(payload);
      settingsForm = null;
      setStatus("Settings saved.");
      render(root);
    } catch (err) {
      setStatus(err.message);
      render(root);
    }
  });

  root.querySelector('[data-action="open-next"]')?.addEventListener("click", () => {
    lockedSession = null;
    justSavedLift = null;
    setStatus("");
    render(root);
    window.scrollTo({ top: 0 });
  });

  root.querySelector('[data-action="complete"]')?.addEventListener("click", async () => {
    store = ensureDraft(store);
    const draft = store.draft;
    if (!allLiftsConfirmed(draft.kind, draft)) {
      setStatus("Finish each lift before saving.");
      render(root);
      return;
    }
    const parsed = draftToEntries(draft.kind, draft, store.progress);
    if (!parsed.ok) {
      setStatus(parsed.message);
      render(root);
      return;
    }
    try {
      const payload = await api("/api/workouts", {
        method: "POST",
        body: JSON.stringify({ kind: draft.kind, lifts: parsed.lifts }),
      });
      applyPayload(payload);
      store = ensureDraft(store);
      lockedSession = payload.session ?? store.sessions.at(-1) ?? null;
      justSavedLift = null;
      setStatus(`Workout ${draft.kind} saved and locked.`, "ok");
      tab = "workout";
      render(root);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setStatus(err.message);
      render(root);
    }
  });

  root.querySelector('[data-action="export"]')?.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stronglifts-5x5-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Exported backup JSON.");
      render(root);
    } catch {
      const blob = new Blob([exportJson(store)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stronglifts-5x5-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Exported backup JSON.");
      render(root);
    }
  });

  root.querySelector('[data-action="import"]')?.addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = await api("/api/import", { method: "POST", body: JSON.stringify({ json: text }) });
      applyPayload(payload);
      store = ensureDraft(store);
      const added = payload.importSummary?.addedSessions ?? 0;
      setStatus(`Imported backup. ${added} new session${added === 1 ? "" : "s"} merged. Server weights kept.`, "ok");
      tab = "history";
      render(root);
    } catch {
      setStatus("Import failed. Use a JSON file exported from this tracker.");
      render(root);
    }
  });

  root.querySelector('[data-action="import-local"]')?.addEventListener("click", async () => {
    if (!localBackupRaw) return;
    try {
      const payload = await api("/api/import", {
        method: "POST",
        body: JSON.stringify({ json: localBackupRaw, source: "localStorage" }),
      });
      applyPayload(payload);
      store = ensureDraft(store);
      const added = payload.importSummary?.addedSessions ?? 0;
      setStatus(
        added
          ? `Added ${added} session${added === 1 ? "" : "s"} from this browser. Server weights kept.`
          : "Nothing new in the browser copy. Server weights kept.",
        "ok",
      );
      render(root);
    } catch (err) {
      setStatus(err.message || "Import failed.");
      render(root);
    }
  });

  root.querySelector('[data-action="import-later"]')?.addEventListener("click", () => {
    localBackupRaw = null;
    setStatus("You can import the browser backup later from History.");
    render(root);
  });
}

function markSaved(root, lift) {
  justSavedLift = lift;
  setStatus(`${LIFTS[lift].name} saved. You can still change it until you save the workout.`, "ok");
  render(root);
  // The outline animates in once; later renders show it static.
  window.setTimeout(() => {
    if (justSavedLift === lift) justSavedLift = null;
  }, 600);
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

export async function mountLiftsTracker(root) {
  initTheme();
  try {
    const payload = await api("/api/state");
    applyPayload(payload);
    if (!localImportDone) localBackupRaw = peekLocalBackup();
    const last = store.sessions.at(-1);
    if (last && sessionDate(last.completedAt) === todayLA()) lockedSession = last;
    store = ensureDraft(store);
    render(root);
  } catch (err) {
    bootError = err.status === 401 || err.status === 403 ? "Access required." : "Cannot reach the server store.";
    render(root);
  }
}
