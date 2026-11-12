import {
  LIFTS,
  WORKOUTS,
  applyCompletedWorkout,
  applyStartingWeights,
  createEmptyStore,
  defaultSettings,
  importJson,
  isValidDraft,
  mergeImportedStore,
  nextWorkoutKind,
  parseStore,
} from "../public/lifts-domain.js";

const LIFT_IDS = Object.keys(LIFTS);

function orderSessionLifts(kind, lifts) {
  const order = (WORKOUTS[kind] || []).map((t) => t.lift);
  return [...lifts].sort((a, b) => {
    const ia = order.indexOf(a.lift);
    const ib = order.indexOf(b.lift);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}


function nowIso() {
  return new Date().toISOString();
}

export async function getMeta(db, key) {
  const row = await db.prepare("SELECT value FROM meta WHERE key = ?").bind(key).first();
  return row?.value ?? null;
}

export async function setMeta(db, key, value) {
  await db
    .prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, value)
    .run();
}

function parsePlates(json) {
  try {
    const plates = JSON.parse(json);
    if (Array.isArray(plates) && plates.every((p) => typeof p === "number")) return plates;
  } catch {
    /* use default */
  }
  return defaultSettings().plates;
}

export async function loadStore(db) {
  const settingsRow = await db.prepare("SELECT bar_weight_lbs, plates_json FROM settings WHERE id = 1").first();
  const progressRows = await db.prepare("SELECT lift, next_weight, consecutive_failures FROM progress").all();
  const sessionRows = await db
    .prepare("SELECT id, kind, completed_at FROM sessions ORDER BY completed_at ASC, created_at ASC")
    .all();
  const liftRows = await db
    .prepare(
      "SELECT session_id, lift, prescribed_weight, prescribed_sets, prescribed_reps, actual_weight, sets_json, notes FROM session_lifts",
    )
    .all();
  const draftRow = await db.prepare("SELECT kind, entries_json FROM draft WHERE id = 1").first();

  const progress = { ...createEmptyStore().progress };
  for (const row of progressRows.results ?? []) {
    if (!LIFTS[row.lift]) continue;
    progress[row.lift] = {
      nextWeight: typeof row.next_weight === "number" ? row.next_weight : row.next_weight == null ? null : Number(row.next_weight),
      consecutiveFailures: Number(row.consecutive_failures) || 0,
    };
    if (!Number.isFinite(progress[row.lift].nextWeight)) progress[row.lift].nextWeight = null;
  }

  const liftsBySession = new Map();
  for (const row of liftRows.results ?? []) {
    let sets;
    try {
      sets = JSON.parse(row.sets_json);
    } catch {
      continue;
    }
    if (!Array.isArray(sets)) continue;
    const list = liftsBySession.get(row.session_id) ?? [];
    list.push({
      lift: row.lift,
      prescribedWeight: row.prescribed_weight,
      prescribedSets: row.prescribed_sets,
      prescribedReps: row.prescribed_reps,
      weight: row.actual_weight,
      sets,
      notes: row.notes ?? "",
    });
    liftsBySession.set(row.session_id, list);
  }

  const sessions = [];
  for (const row of sessionRows.results ?? []) {
    sessions.push({
      id: row.id,
      kind: row.kind,
      completedAt: row.completed_at,
      lifts: orderSessionLifts(row.kind, liftsBySession.get(row.id) ?? []),
    });
  }

  let draft = null;
  if (draftRow) {
    try {
      const entries = JSON.parse(draftRow.entries_json);
      const candidate = { kind: draftRow.kind, entries };
      if (isValidDraft(candidate)) draft = candidate;
    } catch {
      draft = null;
    }
  }

  const settings = settingsRow
    ? { barWeightLbs: Number(settingsRow.bar_weight_lbs), plates: parsePlates(settingsRow.plates_json) }
    : defaultSettings();

  const store = parseStore({
    version: 2,
    sessions,
    progress,
    draft,
    settings,
  });
  return store ?? { ...createEmptyStore(), settings };
}

function progressStatements(db, progress) {
  return LIFT_IDS.map((id) =>
    db
      .prepare(
        "INSERT INTO progress (lift, next_weight, consecutive_failures) VALUES (?, ?, ?) ON CONFLICT(lift) DO UPDATE SET next_weight = excluded.next_weight, consecutive_failures = excluded.consecutive_failures",
      )
      .bind(id, progress[id].nextWeight, progress[id].consecutiveFailures),
  );
}

function settingsStatement(db, settings, updatedAt) {
  return db
    .prepare(
      "INSERT INTO settings (id, bar_weight_lbs, plates_json, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET bar_weight_lbs = excluded.bar_weight_lbs, plates_json = excluded.plates_json, updated_at = excluded.updated_at",
    )
    .bind(settings.barWeightLbs, JSON.stringify(settings.plates), updatedAt);
}

function sessionStatements(db, session, createdAt) {
  const stmts = [
    db
      .prepare("INSERT INTO sessions (id, kind, completed_at, created_at) VALUES (?, ?, ?, ?)")
      .bind(session.id, session.kind, session.completedAt, createdAt),
  ];
  for (const lift of session.lifts) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO session_lifts (session_id, lift, prescribed_weight, prescribed_sets, prescribed_reps, actual_weight, sets_json, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          session.id,
          lift.lift,
          lift.prescribedWeight,
          lift.prescribedSets,
          lift.prescribedReps,
          lift.weight,
          JSON.stringify(lift.sets),
          lift.notes ?? "",
        ),
    );
  }
  stmts.push(
    db
      .prepare(
        "INSERT INTO vault_queue (id, session_id, status, enqueued_at, acked_at) VALUES (?, ?, 'pending', ?, NULL) ON CONFLICT(session_id) DO NOTHING",
      )
      .bind(session.id, session.id, createdAt),
  );
  return stmts;
}

export async function saveDraft(db, draft) {
  if (!isValidDraft(draft)) {
    await db.prepare("DELETE FROM draft WHERE id = 1").run();
    return;
  }
  await db
    .prepare(
      "INSERT INTO draft (id, kind, entries_json, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, entries_json = excluded.entries_json, updated_at = excluded.updated_at",
    )
    .bind(draft.kind, JSON.stringify(draft.entries), nowIso())
    .run();
}

export async function saveSettings(db, settings) {
  await settingsStatement(db, settings, nowIso()).run();
}

export async function completeWorkout(db, kind, lifts, completedAt) {
  const store = await loadStore(db);
  if (kind !== nextWorkoutKind(store)) {
    return { ok: false, status: 409, message: `Next workout is ${nextWorkoutKind(store)}.` };
  }
  if (!WORKOUTS[kind]) return { ok: false, status: 400, message: "Unknown workout." };
  for (const target of WORKOUTS[kind]) {
    const entry = lifts.find((l) => l.lift === target.lift);
    if (!entry) return { ok: false, status: 400, message: `Missing ${target.lift}.` };
    if (typeof entry.weight !== "number" || !Number.isFinite(entry.weight) || entry.weight <= 0) {
      return { ok: false, status: 400, message: `Enter a weight for ${LIFTS[target.lift].name}.` };
    }
    if (!Array.isArray(entry.sets) || entry.sets.length !== target.sets) {
      return { ok: false, status: 400, message: `Log reps for every set of ${LIFTS[target.lift].name}.` };
    }
    if (!entry.sets.every((r) => typeof r === "number" && Number.isFinite(r) && r >= 0)) {
      return { ok: false, status: 400, message: `Log reps for every set of ${LIFTS[target.lift].name}.` };
    }
  }
  const next = applyCompletedWorkout(store, kind, lifts, completedAt ?? nowIso());
  const session = next.sessions.at(-1);
  const createdAt = nowIso();
  const stmts = [
    ...sessionStatements(db, session, createdAt),
    ...progressStatements(db, next.progress),
    db.prepare("DELETE FROM draft WHERE id = 1"),
  ];
  await db.batch(stmts);
  const storeAfter = await loadStore(db);
  return { ok: true, store: storeAfter, session };
}

export async function saveStartingWeights(db, weights) {
  const store = await loadStore(db);
  const result = applyStartingWeights(store, weights);
  if (!result.ok) return result;
  await db.batch(progressStatements(db, result.store.progress));
  await db.prepare("DELETE FROM draft WHERE id = 1").run();
  return { ok: true, store: await loadStore(db) };
}

/**
 * Import a backup (browser copy or JSON file) by MERGING it into D1.
 * It never deletes server sessions, never replaces a server weight with an empty one,
 * and keeps today's draft unless the import carries newer sessions. See mergeImportedStore.
 * (Before 2026-11-12 this wiped D1 and replaced it, which erased Jake's starting weights.)
 */
export async function mergeFromImport(db, text, { markLocalImport = false } = {}) {
  const imported = importJson(text);
  const server = await loadStore(db);
  const settingsRow = await db.prepare("SELECT updated_at FROM settings WHERE id = 1").first();
  const serverSettingsAreDefault = !settingsRow || String(settingsRow.updated_at).startsWith("1970-");
  const merged = mergeImportedStore(server, imported, { serverSettingsAreDefault });
  const createdAt = nowIso();
  const stmts = [...progressStatements(db, merged.store.progress)];
  if (merged.settingsFromImport) stmts.push(settingsStatement(db, merged.store.settings, createdAt));
  for (const session of merged.added) {
    stmts.push(...sessionStatements(db, session, createdAt));
  }
  if (!merged.keptDraft) stmts.push(db.prepare("DELETE FROM draft WHERE id = 1"));
  await db.batch(stmts);
  if (markLocalImport) await setMeta(db, "local_import_done", "1");
  return {
    store: await loadStore(db),
    summary: { addedSessions: merged.added.length, changedLifts: merged.changed, keptDraft: merged.keptDraft },
  };
}

export async function pendingVault(db, limit = 20) {
  const cap = Math.max(1, Math.min(100, Number(limit) || 20));
  const rows = await db
    .prepare(
      "SELECT q.id, q.session_id, q.status, q.enqueued_at, s.kind, s.completed_at FROM vault_queue q JOIN sessions s ON s.id = q.session_id WHERE q.status = 'pending' ORDER BY q.enqueued_at ASC LIMIT ?",
    )
    .bind(cap)
    .all();
  const items = [];
  for (const row of rows.results ?? []) {
    const lifts = await db
      .prepare(
        "SELECT lift, prescribed_weight, prescribed_sets, prescribed_reps, actual_weight, sets_json, notes FROM session_lifts WHERE session_id = ?",
      )
      .bind(row.session_id)
      .all();
    items.push({
      id: row.id,
      sessionId: row.session_id,
      status: row.status,
      enqueuedAt: row.enqueued_at,
      session: {
        id: row.session_id,
        kind: row.kind,
        completedAt: row.completed_at,
        lifts: orderSessionLifts(
          row.kind,
          (lifts.results ?? []).map((l) => ({
            lift: l.lift,
            prescribedWeight: l.prescribed_weight,
            prescribedSets: l.prescribed_sets,
            prescribedReps: l.prescribed_reps,
            weight: l.actual_weight,
            sets: JSON.parse(l.sets_json),
            notes: l.notes ?? "",
          })),
        ),
      },
    });
  }
  return items;
}

export async function ackVault(db, ids) {
  const list = Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id) : [];
  const at = nowIso();
  let updated = 0;
  for (const id of list) {
    const res = await db
      .prepare(
        "UPDATE vault_queue SET status = 'acked', acked_at = COALESCE(acked_at, ?) WHERE (id = ? OR session_id = ?) AND status IN ('pending', 'acked')",
      )
      .bind(at, id, id)
      .run();
    updated += res.meta?.changes ?? 0;
  }
  return { ok: true, updated, ids: list };
}
