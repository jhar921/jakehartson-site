/** StrongLifts 5×5 domain: workouts, progression, persistence. */

export const LIFTS = {
  squat: { id: "squat", name: "Squat", incrementLbs: 5 },
  bench: { id: "bench", name: "Bench Press", incrementLbs: 2.5 },
  row: { id: "row", name: "Barbell Row", incrementLbs: 2.5 },
  ohp: { id: "ohp", name: "Overhead Press", incrementLbs: 2.5 },
  deadlift: { id: "deadlift", name: "Deadlift", incrementLbs: 5 },
};

export const WORKOUTS = {
  A: [
    { lift: "squat", sets: 5, reps: 5 },
    { lift: "bench", sets: 5, reps: 5 },
    { lift: "row", sets: 5, reps: 5 },
  ],
  B: [
    { lift: "squat", sets: 5, reps: 5 },
    { lift: "ohp", sets: 5, reps: 5 },
    { lift: "deadlift", sets: 1, reps: 5 },
  ],
};

export const STORAGE_KEY = "jakehartson.stronglifts.v1";

export function emptyProgress() {
  return {
    squat: { nextWeight: null, consecutiveFailures: 0 },
    bench: { nextWeight: null, consecutiveFailures: 0 },
    row: { nextWeight: null, consecutiveFailures: 0 },
    ohp: { nextWeight: null, consecutiveFailures: 0 },
    deadlift: { nextWeight: null, consecutiveFailures: 0 },
  };
}

export function createEmptyStore() {
  return { version: 1, sessions: [], progress: emptyProgress(), draft: null };
}

export function nextWorkoutKind(store) {
  const last = store.sessions.at(-1);
  if (!last) return "A";
  return last.kind === "A" ? "B" : "A";
}

export function isLiftSuccess(entry, target) {
  if (entry.sets.length !== target.sets) return false;
  return entry.sets.every((reps) => typeof reps === "number" && reps >= target.reps);
}

/** Round to nearest 0.25 lb so 2.5 lb plates stay clean. */
export function roundWeight(lbs) {
  return Math.round(lbs * 4) / 4;
}

export function applyCompletedWorkout(store, kind, lifts, completedAt = new Date().toISOString()) {
  const progress = { ...store.progress };
  for (const target of WORKOUTS[kind]) {
    const entry = lifts.find((l) => l.lift === target.lift);
    if (!entry) continue;
    const success = isLiftSuccess(entry, target);
    if (success) {
      progress[target.lift] = {
        nextWeight: roundWeight(entry.weight + LIFTS[target.lift].incrementLbs),
        consecutiveFailures: 0,
      };
    } else {
      const failures = (progress[target.lift]?.consecutiveFailures ?? 0) + 1;
      if (failures >= 3) {
        progress[target.lift] = {
          nextWeight: roundWeight(entry.weight * 0.9),
          consecutiveFailures: 0,
        };
      } else {
        progress[target.lift] = {
          nextWeight: entry.weight,
          consecutiveFailures: failures,
        };
      }
    }
  }

  const session = {
    id: crypto.randomUUID(),
    kind,
    completedAt,
    lifts,
  };

  return {
    version: 1,
    sessions: [...store.sessions, session],
    progress,
    draft: null,
  };
}

export function ensureDraft(store) {
  const kind = nextWorkoutKind(store);
  if (store.draft && store.draft.kind === kind) return store;

  const entries = {};
  for (const target of WORKOUTS[kind]) {
    const next = store.progress[target.lift].nextWeight;
    entries[target.lift] = {
      weight: next,
      sets: Array.from({ length: target.sets }, () => null),
      notes: "",
    };
  }
  return { ...store, draft: { kind, entries } };
}

export function parseStore(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw;
  if (data.version !== 1 || !Array.isArray(data.sessions) || !data.progress) {
    return null;
  }
  const progress = emptyProgress();
  for (const id of Object.keys(LIFTS)) {
    const p = data.progress[id];
    if (p && typeof p === "object") {
      progress[id] = {
        nextWeight:
          typeof p.nextWeight === "number" && Number.isFinite(p.nextWeight)
            ? p.nextWeight
            : null,
        consecutiveFailures:
          typeof p.consecutiveFailures === "number" && p.consecutiveFailures >= 0
            ? Math.floor(p.consecutiveFailures)
            : 0,
      };
    }
  }
  return {
    version: 1,
    sessions: data.sessions,
    progress,
    draft: data.draft ?? null,
  };
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStore();
    const parsed = parseStore(JSON.parse(raw));
    return parsed ?? createEmptyStore();
  } catch {
    return createEmptyStore();
  }
}

export function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function exportJson(store) {
  const { draft: _draft, ...rest } = store;
  return JSON.stringify({ ...rest, draft: null }, null, 2);
}

export function importJson(text) {
  const parsed = parseStore(JSON.parse(text));
  if (!parsed) throw new Error("Invalid StrongLifts backup JSON");
  return { ...parsed, draft: null };
}

export function draftToEntries(kind, draft) {
  const lifts = [];
  for (const target of WORKOUTS[kind]) {
    const d = draft.entries[target.lift];
    if (!d || d.weight === null || !Number.isFinite(d.weight) || d.weight <= 0) {
      return { ok: false, message: `Enter a weight for ${LIFTS[target.lift].name}.` };
    }
    const sets = [];
    for (let i = 0; i < target.sets; i++) {
      const reps = d.sets[i];
      if (reps === null || reps === undefined || !Number.isFinite(reps) || reps < 0) {
        return {
          ok: false,
          message: `Log reps for every set of ${LIFTS[target.lift].name}.`,
        };
      }
      sets.push(Math.floor(reps));
    }
    lifts.push({
      lift: target.lift,
      weight: d.weight,
      sets,
      notes: (d.notes ?? "").trim(),
    });
  }
  return { ok: true, lifts };
}

export function firstIncompleteLiftIndex(kind, draft) {
  const targets = WORKOUTS[kind];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const d = draft.entries[t.lift];
    if (!d) return i;
    if (d.weight === null) return i;
    if (d.sets.some((r) => r === null || r === undefined)) return i;
  }
  return targets.length - 1;
}
