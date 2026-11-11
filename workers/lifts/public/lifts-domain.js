/** StrongLifts 5x5 domain: workouts, progression, warmup, plates, persistence shape. */

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

export const BAR_START_LIFTS = new Set(["squat", "bench", "ohp"]);
export const STORAGE_KEY = "jakehartson.stronglifts.v1";
export const STORE_VERSION = 2;
export const DEFAULT_BAR_LBS = 45;
export const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5];
export const DELOAD_AFTER = 3;
export const DELOAD_FRACTION = 0.9;
const MIN_WARMUP_GAP = 10;
const MAX_WARMUP_JUMP = 50;

export function defaultSettings() {
  return { barWeightLbs: DEFAULT_BAR_LBS, plates: [...DEFAULT_PLATES] };
}

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
  return {
    version: STORE_VERSION,
    sessions: [],
    progress: emptyProgress(),
    draft: null,
    settings: defaultSettings(),
  };
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

/** Round to the nearest 0.25 lb (keeps entered weights exact). */
export function roundWeight(lbs) {
  return Math.round(lbs * 4) / 4;
}

/** Round down to a loadable 2.5 lb step (used for deloads). */
export function roundToPlate(lbs) {
  return Math.floor(lbs / 2.5 + 1e-9) * 2.5;
}

export function formatLbs(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function normalizeSettings(raw) {
  const fallback = defaultSettings();
  if (!raw || typeof raw !== "object") return fallback;
  const bar =
    typeof raw.barWeightLbs === "number" && Number.isFinite(raw.barWeightLbs) && raw.barWeightLbs > 0
      ? roundWeight(raw.barWeightLbs)
      : fallback.barWeightLbs;
  const plates = Array.isArray(raw.plates)
    ? raw.plates
        .filter((p) => typeof p === "number" && Number.isFinite(p) && p > 0)
        .map((p) => roundWeight(p))
        .sort((a, b) => b - a)
    : fallback.plates;
  return { barWeightLbs: bar, plates: plates.length ? plates : fallback.plates };
}

function decorateSessionLift(kind, lift) {
  const target = WORKOUTS[kind].find((t) => t.lift === lift.lift);
  return {
    lift: lift.lift,
    prescribedWeight:
      typeof lift.prescribedWeight === "number" && Number.isFinite(lift.prescribedWeight)
        ? lift.prescribedWeight
        : lift.weight,
    prescribedSets:
      typeof lift.prescribedSets === "number" && lift.prescribedSets > 0
        ? Math.floor(lift.prescribedSets)
        : target.sets,
    prescribedReps:
      typeof lift.prescribedReps === "number" && lift.prescribedReps > 0
        ? Math.floor(lift.prescribedReps)
        : target.reps,
    weight: lift.weight,
    sets: lift.sets,
    notes: (lift.notes ?? "").toString(),
  };
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
      if (failures >= DELOAD_AFTER) {
        progress[target.lift] = {
          nextWeight: roundToPlate(entry.weight * DELOAD_FRACTION),
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
    lifts: lifts.map((l) => decorateSessionLift(kind, l)),
  };

  return {
    version: STORE_VERSION,
    sessions: [...store.sessions, session],
    progress,
    draft: null,
    settings: normalizeSettings(store.settings),
  };
}

function emptyDraftEntry(target, nextWeight) {
  return {
    weight: nextWeight,
    sets: Array.from({ length: target.sets }, () => null),
    notes: "",
    confirmed: false,
    overrideOpen: false,
  };
}

export function ensureDraft(store) {
  const kind = nextWorkoutKind(store);
  if (store.draft && store.draft.kind === kind) return store;

  const entries = {};
  for (const target of WORKOUTS[kind]) {
    const next = store.progress[target.lift].nextWeight;
    entries[target.lift] = emptyDraftEntry(target, next);
  }
  return { ...store, draft: { kind, entries } };
}

function isRepValue(v) {
  return v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
}

/** A draft is only kept when every entry matches its workout shape; otherwise it is rebuilt. */
export function isValidDraft(draft) {
  if (!draft || typeof draft !== "object") return false;
  if (draft.kind !== "A" && draft.kind !== "B") return false;
  if (!draft.entries || typeof draft.entries !== "object") return false;
  return WORKOUTS[draft.kind].every((t) => {
    const e = draft.entries[t.lift];
    return (
      e &&
      typeof e === "object" &&
      (e.weight === null || (typeof e.weight === "number" && Number.isFinite(e.weight))) &&
      Array.isArray(e.sets) &&
      e.sets.length === t.sets &&
      e.sets.every(isRepValue) &&
      (e.notes === undefined || typeof e.notes === "string") &&
      (e.confirmed === undefined || typeof e.confirmed === "boolean") &&
      (e.overrideOpen === undefined || typeof e.overrideOpen === "boolean")
    );
  });
}

export function needsStartingWeights(store) {
  return Object.keys(LIFTS).some((id) => store.progress[id].nextWeight === null);
}

export function applyStartingWeights(store, weights) {
  const progress = { ...store.progress };
  for (const id of Object.keys(LIFTS)) {
    const raw = weights[id];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
      return { ok: false, message: `Enter a starting weight for ${LIFTS[id].name}.` };
    }
    progress[id] = {
      nextWeight: roundWeight(raw),
      consecutiveFailures: progress[id]?.consecutiveFailures ?? 0,
    };
  }
  return { ok: true, store: { ...store, progress, draft: null } };
}

export function lastLiftEntry(store, liftId) {
  for (let i = store.sessions.length - 1; i >= 0; i--) {
    const session = store.sessions[i];
    const entry = session.lifts.find((l) => l.lift === liftId);
    if (entry) return { session, entry, target: WORKOUTS[session.kind].find((t) => t.lift === liftId) };
  }
  return null;
}

export function prescriptionWhy(store, liftId) {
  const found = lastLiftEntry(store, liftId);
  if (!found) {
    return store.progress[liftId]?.nextWeight != null ? "Starting weight" : "Set a starting weight";
  }
  const success = isLiftSuccess(found.entry, found.target);
  const failures = store.progress[liftId]?.consecutiveFailures ?? 0;
  if (success) return `Last time ${found.entry.sets.join("/")} at ${formatLbs(found.entry.weight)}`;
  if (failures === 0) return "Deload after 3 misses";
  return failures === 1 ? "Repeat, 1 miss in a row" : `Repeat, ${failures} misses in a row`;
}

export function doneAsPrescribed(target, prescribedWeight) {
  return {
    lift: target.lift,
    prescribedWeight,
    prescribedSets: target.sets,
    prescribedReps: target.reps,
    weight: prescribedWeight,
    sets: Array.from({ length: target.sets }, () => target.reps),
    notes: "",
  };
}

export function confirmDraftLift(entry, target, prescribedWeight) {
  const weight =
    entry.weight === null || entry.weight === undefined ? prescribedWeight : entry.weight;
  const sets = entry.sets.map((r) => (r === null || r === undefined ? target.reps : r));
  return {
    ...entry,
    weight,
    sets,
    confirmed: true,
    overrideOpen: false,
  };
}

function ticks(lbs) {
  return Math.round(lbs * 4);
}

function fromTicks(n) {
  return n / 4;
}

function canMakeSide(sideLbs, plates) {
  const target = ticks(sideLbs);
  if (target < 0) return false;
  if (target === 0) return true;
  const units = [...new Set(plates.map((p) => ticks(p)).filter((p) => p > 0))].sort((a, b) => a - b);
  if (!units.length) return false;
  const dp = new Uint8Array(target + 1);
  dp[0] = 1;
  for (let i = 0; i <= target; i++) {
    if (!dp[i]) continue;
    for (const p of units) {
      const n = i + p;
      if (n <= target) dp[n] = 1;
    }
  }
  return dp[target] === 1;
}

export function isLoadable(weight, bar = DEFAULT_BAR_LBS, plates = DEFAULT_PLATES) {
  if (typeof weight !== "number" || !Number.isFinite(weight)) return false;
  if (weight + 1e-9 < bar) return false;
  const side = (weight - bar) / 2;
  if (Math.abs(side - roundWeight(side)) > 1e-9) return false;
  return canMakeSide(side, plates);
}

function greedyEachSide(sideLbs, plates) {
  const sorted = [...plates].filter((p) => p > 0).sort((a, b) => b - a);
  const result = [];
  let rem = ticks(sideLbs);
  for (const p of sorted) {
    const unit = ticks(p);
    const n = Math.floor((rem + 1e-9) / unit);
    if (n > 0) {
      result.push({ plate: p, count: n });
      rem -= n * unit;
    }
  }
  if (rem > 0) return null;
  return result;
}

function searchEachSide(sideLbs, plates) {
  const greedy = greedyEachSide(sideLbs, plates);
  if (greedy) return greedy;
  const units = [...plates].filter((p) => p > 0).sort((a, b) => b - a);
  const target = ticks(sideLbs);
  const counts = [];
  function dfs(i, rem) {
    if (rem === 0) return true;
    if (i >= units.length || rem < 0) return false;
    const unit = ticks(units[i]);
    const max = Math.floor(rem / unit);
    for (let n = max; n >= 0; n--) {
      if (n) counts.push({ plate: units[i], count: n });
      if (dfs(i + 1, rem - n * unit)) return true;
      if (n) counts.pop();
    }
    return false;
  }
  if (dfs(0, target)) return counts.slice();
  return null;
}

export function nearestLoadableAtOrBelow(weight, bar = DEFAULT_BAR_LBS, plates = DEFAULT_PLATES) {
  if (weight + 1e-9 < bar) return null;
  if (isLoadable(weight, bar, plates)) return roundWeight(weight);
  // Walk the 0.25 lb quantum so 2.5 lb program jumps are not skipped.
  // Default commercial plates (smallest 2.5 each side) only hit 5 lb totals.
  let w = roundWeight(weight - 0.25);
  while (w + 1e-9 >= bar) {
    if (isLoadable(w, bar, plates)) return w;
    w = roundWeight(w - 0.25);
  }
  return isLoadable(bar, bar, plates) ? bar : null;
}

export function platePlan(workWeight, bar = DEFAULT_BAR_LBS, plates = DEFAULT_PLATES) {
  const loadable = isLoadable(workWeight, bar, plates);
  const used = loadable ? roundWeight(workWeight) : nearestLoadableAtOrBelow(workWeight, bar, plates);
  if (used === null) {
    return { loadable: false, weight: null, eachSide: [], flagged: true };
  }
  const eachSide = searchEachSide((used - bar) / 2, plates) ?? [];
  return {
    loadable,
    weight: used,
    eachSide,
    flagged: !loadable,
  };
}

export function formatPlatePlan(plan) {
  if (!plan || plan.weight === null) return "Cannot load this weight with the current bar and plates.";
  if (plan.eachSide.length === 0) return "Empty bar";
  const parts = plan.eachSide.map((p) => `${p.count} x ${formatLbs(p.plate)}`).join(" + ");
  const line = `${parts} each side`;
  if (plan.flagged) return `Nearest loadable ${formatLbs(plan.weight)} lb. ${line}`;
  return line;
}

function plateLandmarks(bar) {
  const marks = [bar];
  let add50 = true;
  let w = bar;
  while (w < 2000) {
    w = roundWeight(w + (add50 ? 50 : 40));
    marks.push(w);
    add50 = !add50;
  }
  return marks;
}

function nextWarmupJump(last, work, bar, plates) {
  if (work - last <= MAX_WARMUP_JUMP) return null;
  const landmark = plateLandmarks(bar).find((w) => w > last);
  if (
    landmark != null &&
    landmark < work &&
    work - landmark >= MIN_WARMUP_GAP &&
    landmark - last <= MAX_WARMUP_JUMP &&
    isLoadable(landmark, bar, plates)
  ) {
    return landmark;
  }
  for (const jump of [50, 45, 40]) {
    const w = roundWeight(last + jump);
    if (w < work && work - w >= MIN_WARMUP_GAP && isLoadable(w, bar, plates)) return w;
  }
  const cap = Math.min(last + MAX_WARMUP_JUMP, work - MIN_WARMUP_GAP);
  const nearest = nearestLoadableAtOrBelow(cap, bar, plates);
  if (nearest != null && nearest > last && nearest < work) return nearest;
  return null;
}

export function warmupSets(lift, workWeight, bar = DEFAULT_BAR_LBS, plates = DEFAULT_PLATES) {
  if (typeof workWeight !== "number" || !Number.isFinite(workWeight) || workWeight <= bar + 10) {
    return [];
  }
  const floorStart = BAR_START_LIFTS.has(lift)
    ? bar
    : nearestLoadableAtOrBelow(Math.max(bar + 20, 95), bar, plates) ?? Math.max(bar + 20, 95);

  if (floorStart >= workWeight) return [];

  const steps = [];
  if (floorStart === bar) {
    steps.push(bar);
    if (workWeight >= 135) steps.push(bar);
  } else {
    steps.push(floorStart);
  }

  let last = steps[steps.length - 1];
  while (true) {
    const next = nextWarmupJump(last, workWeight, bar, plates);
    if (next == null) break;
    steps.push(next);
    last = next;
  }

  const seen = [];
  for (const w of steps) {
    if (w < workWeight && (seen.length === 0 || seen[seen.length - 1] !== w || w === bar)) {
      seen.push(w);
    }
  }
  // Keep a single repeated empty-bar set (official 225 squat starts 45, 45). Collapse other dups.
  const out = [];
  let barRepeats = 0;
  for (const w of seen) {
    if (w === bar && BAR_START_LIFTS.has(lift)) {
      if (barRepeats < 2) {
        out.push(w);
        barRepeats++;
      }
    } else if (!out.includes(w) || w === bar) {
      out.push(w);
    }
  }
  return out.filter((w) => w < workWeight).map((weight) => ({ weight, reps: 5 }));
}

function parseProgress(raw) {
  const progress = emptyProgress();
  if (!raw || typeof raw !== "object") return progress;
  for (const id of Object.keys(LIFTS)) {
    const p = raw[id];
    if (p && typeof p === "object") {
      progress[id] = {
        nextWeight:
          typeof p.nextWeight === "number" && Number.isFinite(p.nextWeight) ? p.nextWeight : null,
        consecutiveFailures:
          typeof p.consecutiveFailures === "number" && p.consecutiveFailures >= 0
            ? Math.floor(p.consecutiveFailures)
            : 0,
      };
    }
  }
  return progress;
}

function isValidSessionLift(kind, lift) {
  return (
    lift &&
    typeof lift === "object" &&
    WORKOUTS[kind].some((t) => t.lift === lift.lift) &&
    typeof lift.weight === "number" &&
    Number.isFinite(lift.weight) &&
    Array.isArray(lift.sets) &&
    lift.sets.every((r) => typeof r === "number" && Number.isFinite(r) && r >= 0) &&
    (lift.notes === undefined || typeof lift.notes === "string") &&
    (lift.prescribedWeight === undefined ||
      (typeof lift.prescribedWeight === "number" && Number.isFinite(lift.prescribedWeight))) &&
    (lift.prescribedSets === undefined ||
      (typeof lift.prescribedSets === "number" && lift.prescribedSets > 0)) &&
    (lift.prescribedReps === undefined ||
      (typeof lift.prescribedReps === "number" && lift.prescribedReps > 0))
  );
}

export function parseStore(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw;
  if ((data.version !== 1 && data.version !== 2) || !Array.isArray(data.sessions) || !data.progress) {
    return null;
  }
  const progress = parseProgress(data.progress);
  const sessions = data.sessions
    .filter(
      (s) =>
        s &&
        typeof s === "object" &&
        (s.kind === "A" || s.kind === "B") &&
        Array.isArray(s.lifts) &&
        s.lifts.every((l) => isValidSessionLift(s.kind, l)) &&
        typeof s.completedAt === "string",
    )
    .map((s) => ({
      id: typeof s.id === "string" && s.id ? s.id : crypto.randomUUID(),
      kind: s.kind,
      completedAt: s.completedAt,
      lifts: s.lifts.map((l) => decorateSessionLift(s.kind, l)),
    }));
  const draft = isValidDraft(data.draft) ? data.draft : null;
  return {
    version: STORE_VERSION,
    sessions,
    progress,
    draft,
    settings: normalizeSettings(data.settings),
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
  return JSON.stringify({ ...rest, version: STORE_VERSION, draft: null, settings: normalizeSettings(store.settings) }, null, 2);
}

export function importJson(text) {
  const parsed = parseStore(JSON.parse(text));
  if (!parsed) throw new Error("Invalid StrongLifts backup JSON");
  return { ...parsed, draft: null };
}

export function draftToEntries(kind, draft, progress = null) {
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
    const prescribed =
      progress && typeof progress[target.lift]?.nextWeight === "number"
        ? progress[target.lift].nextWeight
        : typeof d.prescribedWeight === "number"
          ? d.prescribedWeight
          : d.weight;
    lifts.push({
      lift: target.lift,
      prescribedWeight: prescribed,
      prescribedSets: target.sets,
      prescribedReps: target.reps,
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
    if (d.confirmed) continue;
    if (d.weight === null) return i;
    if (d.sets.some((r) => r === null || r === undefined)) return i;
    // Unconfirmed prefill (or a lift the lifter has not accepted) stays current.
    return i;
  }
  return Math.max(0, targets.length - 1);
}

export function allLiftsConfirmed(kind, draft) {
  return WORKOUTS[kind].every((t) => draft.entries[t.lift]?.confirmed);
}

export function liftHit(entry) {
  const target = {
    sets: entry.prescribedSets,
    reps: entry.prescribedReps,
  };
  return isLiftSuccess(entry, target);
}

export function renderVaultNote(session, { timezone = "America/Los_Angeles" } = {}) {
  const date = sessionDate(session.completedAt, timezone);
  const lines = [
    "---",
    "type: workout",
    `date: ${date}`,
    `session: ${session.kind}`,
    `workout_id: ${session.id}`,
    "source: lifts.jakehartson.com",
    `created: ${date}`,
    `updated: ${date}`,
    "lifts:",
  ];
  for (const lift of session.lifts) {
    const hit = liftHit(lift) ? "hit" : "miss";
    lines.push(`  - lift: ${lift.lift}`);
    lines.push(`    prescribed_weight: ${formatLbs(lift.prescribedWeight)}`);
    lines.push(`    prescribed_sets: ${lift.prescribedSets}`);
    lines.push(`    prescribed_reps: ${lift.prescribedReps}`);
    lines.push(`    weight: ${formatLbs(lift.weight)}`);
    lines.push(`    sets: [${lift.sets.join(", ")}]`);
    lines.push(`    result: ${hit}`);
    if (lift.notes) lines.push(`    notes: ${yamlQuote(lift.notes)}`);
  }
  lines.push("---");
  lines.push("");
  lines.push(`# Workout ${session.kind} · ${date}`);
  lines.push("");
  lines.push("| Lift | Prescribed | Actual | Sets | Result |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const lift of session.lifts) {
    const hit = liftHit(lift) ? "hit" : "miss";
    const prescribed = `${formatLbs(lift.prescribedWeight)} lb ${lift.prescribedSets}x${lift.prescribedReps}`;
    const actual = `${formatLbs(lift.weight)} lb`;
    lines.push(
      `| ${LIFTS[lift.lift].name} | ${prescribed} | ${actual} | ${lift.sets.join("/")} | ${hit} |`,
    );
  }
  const notes = session.lifts.map((l) => l.notes).filter(Boolean);
  if (notes.length) {
    lines.push("");
    lines.push("## Notes");
    for (const lift of session.lifts) {
      if (lift.notes) lines.push(`- ${LIFTS[lift.lift].name}: ${lift.notes}`);
    }
  }
  lines.push("");
  return { date, markdown: lines.join("\n"), filename: `${date} ${session.kind} workout.md` };
}

export function sessionDate(iso, timezone = "America/Los_Angeles") {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));
    const get = (t) => parts.find((p) => p.type === t).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return String(iso).slice(0, 10);
  }
}

export function uniqueVaultFilename(filename, existingNames) {
  if (!existingNames.has(filename)) return filename;
  const suffix = filename.endsWith(".md") ? ".md" : "";
  const stem = suffix ? filename.slice(0, -suffix.length) : filename;
  let n = 2;
  while (existingNames.has(`${stem}-${n}${suffix}`)) n++;
  return `${stem}-${n}${suffix}`;
}

function yamlQuote(value) {
  const s = String(value);
  if (/[:#\-?{}[\],&*!|>'"%@`]/.test(s) || s !== s.trim()) {
    return JSON.stringify(s);
  }
  return s;
}
