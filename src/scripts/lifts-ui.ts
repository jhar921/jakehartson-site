import {
  type Draft,
  type LiftId,
  type Store,
  type WorkoutKind,
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
} from './lifts-domain';

type Tab = 'workout' | 'history';

let store: Store = createBootStore();
let tab: Tab = 'workout';
let statusMessage = '';

function createBootStore(): Store {
  return ensureDraft(loadStore());
}

function persist(): void {
  saveStore(store);
}

function setStatus(msg: string): void {
  statusMessage = msg;
}

function formatWeight(n: number | null): string {
  if (n === null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function render(root: HTMLElement): void {
  store = ensureDraft(store);
  const draft = store.draft!;
  const kind = draft.kind as WorkoutKind;
  const targets = WORKOUTS[kind];
  const focusIdx = firstIncompleteLiftIndex(kind, draft);

  root.innerHTML = `
    <div class="lifts-shell">
      <header class="lifts-header">
        <p class="lifts-kicker">Personal tracker · lbs</p>
        <h1 class="lifts-title">StrongLifts 5×5</h1>
        <p class="lifts-sub">Alternating A/B · about 45 min · rest 3–5 min between work sets</p>
      </header>

      <nav class="lifts-tabs" role="tablist" aria-label="Tracker views">
        <button type="button" role="tab" class="lifts-tab ${tab === 'workout' ? 'is-active' : ''}" data-tab="workout" aria-selected="${tab === 'workout'}">Today</button>
        <button type="button" role="tab" class="lifts-tab ${tab === 'history' ? 'is-active' : ''}" data-tab="history" aria-selected="${tab === 'history'}">History</button>
      </nav>

      <div class="lifts-status" role="status" aria-live="polite">${escapeHtml(statusMessage)}</div>

      ${tab === 'workout' ? renderWorkout(kind, draft, targets, focusIdx) : renderHistory()}
    </div>
  `;

  bind(root);
}

function renderWorkout(
  kind: WorkoutKind,
  draft: Draft,
  targets: (typeof WORKOUTS)[WorkoutKind],
  focusIdx: number,
): string {
  const nextLift = targets[focusIdx];
  return `
    <section class="lifts-panel" aria-labelledby="workout-heading">
      <div class="lifts-workout-banner">
        <h2 id="workout-heading" class="lifts-h2">Workout ${kind}</h2>
        <p class="lifts-next">Next up: <strong>${escapeHtml(LIFTS[nextLift.lift].name)}</strong></p>
      </div>
      <ol class="lifts-list">
        ${targets
          .map((t, i) => {
            const entry = draft.entries[t.lift]!;
            const complete =
              entry.weight !== null && entry.sets.every((r) => r !== null && r !== undefined);
            const success =
              complete &&
              isLiftSuccess(
                { sets: entry.sets.map((r) => r ?? 0) },
                t,
              );
            return `
              <li class="lifts-card ${i === focusIdx ? 'is-focus' : ''} ${complete ? 'is-filled' : ''}" data-lift="${t.lift}">
                <div class="lifts-card-head">
                  <h3 class="lifts-h3">${escapeHtml(LIFTS[t.lift].name)}</h3>
                  <span class="lifts-scheme">${t.sets}×${t.reps}</span>
                  ${complete ? `<span class="lifts-badge ${success ? 'ok' : 'miss'}">${success ? 'Success' : 'Miss'}</span>` : ''}
                </div>
                <div class="lifts-field">
                  <label for="w-${t.lift}">Weight (lb)</label>
                  <input id="w-${t.lift}" name="weight-${t.lift}" type="number" inputmode="decimal" step="0.5" min="0" enterkeyhint="next"
                    value="${entry.weight ?? ''}" data-lift="${t.lift}" data-field="weight"
                    ${store.progress[t.lift].nextWeight === null ? 'placeholder="Starting weight"' : ''} />
                  ${
                    store.progress[t.lift].nextWeight !== null
                      ? `<p class="lifts-help" id="help-w-${t.lift}">Recommended ${formatWeight(store.progress[t.lift].nextWeight)} lb${
                          store.progress[t.lift].consecutiveFailures
                            ? ` · ${store.progress[t.lift].consecutiveFailures} fail${store.progress[t.lift].consecutiveFailures === 1 ? '' : 's'} in a row`
                            : ''
                        }</p>`
                      : `<p class="lifts-help" id="help-w-${t.lift}">No history yet. Enter your starting weight.</p>`
                  }
                </div>
                <fieldset class="lifts-sets">
                  <legend>Reps per set</legend>
                  <div class="lifts-set-grid" style="--cols: ${t.sets}">
                    ${Array.from({ length: t.sets }, (_, s) => `
                      <div class="lifts-set">
                        <label for="s-${t.lift}-${s}">Set ${s + 1}</label>
                        <input id="s-${t.lift}-${s}" name="set-${t.lift}-${s}" type="number" inputmode="numeric" min="0" max="20" step="1" enterkeyhint="next"
                          value="${entry.sets[s] ?? ''}" data-lift="${t.lift}" data-field="set" data-set="${s}" />
                      </div>
                    `).join('')}
                  </div>
                </fieldset>
                <div class="lifts-field">
                  <label for="n-${t.lift}">Notes <span class="lifts-optional">(optional)</span></label>
                  <input id="n-${t.lift}" name="notes-${t.lift}" type="text" enterkeyhint="done"
                    value="${escapeAttr(entry.notes)}" data-lift="${t.lift}" data-field="notes" autocomplete="off" />
                </div>
              </li>
            `;
          })
          .join('')}
      </ol>
      <p class="lifts-tip">Tip: rest 3–5 minutes between work sets. No timer here on purpose.</p>
      <button type="button" class="btn-primary lifts-complete" data-action="complete">Mark workout complete</button>
    </section>
  `;
}

function renderHistory(): string {
  const liftIds = Object.keys(LIFTS) as LiftId[];
  const sessions = [...store.sessions].reverse();
  return `
    <section class="lifts-panel" aria-labelledby="history-heading">
      <h2 id="history-heading" class="lifts-h2">Next weights</h2>
      <p class="lifts-help">Next workout: <strong>${nextWorkoutKind(store)}</strong></p>
      <ul class="lifts-weight-list">
        ${liftIds
          .map((id) => {
            const p = store.progress[id];
            return `<li><span>${escapeHtml(LIFTS[id].name)}</span><span>${
              p.nextWeight === null
                ? 'Not set'
                : `${formatWeight(p.nextWeight)} lb`
            }${p.consecutiveFailures ? ` · ${p.consecutiveFailures} fail streak` : ''}</span></li>`;
          })
          .join('')}
      </ul>

      <h2 class="lifts-h2 lifts-h2-spaced">Sessions</h2>
      ${
        sessions.length === 0
          ? `<p class="lifts-help">No sessions logged yet.</p>`
          : `<ol class="lifts-history">
              ${sessions
                .slice(0, 30)
                .map((s) => {
                  const lines = s.lifts
                    .map((l) => {
                      const target = WORKOUTS[s.kind].find((t) => t.lift === l.lift)!;
                      const ok = isLiftSuccess(l, target);
                      return `${LIFTS[l.lift].name} ${formatWeight(l.weight)} × ${l.sets.join('/')}${ok ? '' : ' (miss)'}`;
                    })
                    .join(' · ');
                  return `<li><div class="lifts-hist-top"><strong>Workout ${s.kind}</strong><time datetime="${escapeAttr(s.completedAt)}">${formatDate(s.completedAt)}</time></div><p>${escapeHtml(lines)}</p></li>`;
                })
                .join('')}
            </ol>`
      }

      <h2 class="lifts-h2 lifts-h2-spaced">Backup</h2>
      <p class="lifts-help">Data stays in this browser only. Export before clearing site data.</p>
      <div class="lifts-backup">
        <button type="button" class="btn-secondary" data-action="export">Export JSON</button>
        <label class="btn-secondary lifts-file-label">
          Import JSON
          <input type="file" accept="application/json,.json" data-action="import" class="visually-hidden" />
        </label>
      </div>
    </section>
  `;
}

function bind(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tab = btn.dataset.tab as Tab;
      setStatus('');
      render(root);
    });
  });

  root.querySelectorAll<HTMLInputElement>('input[data-lift]').forEach((input) => {
    const sync = () => {
      const lift = input.dataset.lift as LiftId;
      const field = input.dataset.field;
      store = ensureDraft(store);
      const draft = store.draft!;
      const entry = draft.entries[lift]!;
      if (field === 'weight') {
        const v = input.value.trim();
        entry.weight = v === '' ? null : Number(v);
      } else if (field === 'set') {
        const idx = Number(input.dataset.set);
        const v = input.value.trim();
        entry.sets[idx] = v === '' ? null : Number(v);
      } else if (field === 'notes') {
        entry.notes = input.value;
      }
      draft.entries[lift] = entry;
      store = { ...store, draft };
      persist();
    };
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
  });

  root.querySelector<HTMLButtonElement>('[data-action="complete"]')?.addEventListener('click', () => {
    store = ensureDraft(store);
    const draft = store.draft!;
    const parsed = draftToEntries(draft.kind, draft);
    if (!parsed.ok) {
      setStatus(parsed.message);
      render(root);
      return;
    }
    store = applyCompletedWorkout(store, draft.kind, parsed.lifts);
    store = ensureDraft(store);
    persist();
    setStatus(`Workout ${draft.kind} saved. Next up: Workout ${store.draft!.kind}.`);
    tab = 'workout';
    render(root);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  root.querySelector<HTMLButtonElement>('[data-action="export"]')?.addEventListener('click', () => {
    const blob = new Blob([exportJson(store)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stronglifts-5x5-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported backup JSON.');
    render(root);
  });

  root.querySelector<HTMLInputElement>('[data-action="import"]')?.addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      store = ensureDraft(importJson(text));
      persist();
      setStatus('Imported backup. Draft reset to next workout.');
      tab = 'history';
      render(root);
    } catch {
      setStatus('Import failed. Use a JSON file exported from this tracker.');
      render(root);
    }
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replaceAll("'", '&#39;');
}

export function mountLiftsTracker(root: HTMLElement): void {
  store = createBootStore();
  persist();
  render(root);
}
