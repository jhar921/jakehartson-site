/**
 * Lightweight domain checks (no browser). Run: node scripts/test-lifts-domain.mjs
 * Mirrors src/scripts/lifts-domain.ts rules.
 */
const LIFTS = {
  squat: { incrementLbs: 5 },
  bench: { incrementLbs: 2.5 },
  row: { incrementLbs: 2.5 },
  ohp: { incrementLbs: 2.5 },
  deadlift: { incrementLbs: 5 },
};
const WORKOUTS = {
  A: [
    { lift: 'squat', sets: 5, reps: 5 },
    { lift: 'bench', sets: 5, reps: 5 },
    { lift: 'row', sets: 5, reps: 5 },
  ],
  B: [
    { lift: 'squat', sets: 5, reps: 5 },
    { lift: 'ohp', sets: 5, reps: 5 },
    { lift: 'deadlift', sets: 1, reps: 5 },
  ],
};

function roundWeight(lbs) {
  return Math.round(lbs * 4) / 4;
}
function isLiftSuccess(entry, target) {
  if (entry.sets.length !== target.sets) return false;
  return entry.sets.every((r) => r >= target.reps);
}
function nextWorkoutKind(sessions) {
  const last = sessions.at(-1);
  if (!last) return 'A';
  return last.kind === 'A' ? 'B' : 'A';
}
function emptyProgress() {
  return Object.fromEntries(
    Object.keys(LIFTS).map((id) => [id, { nextWeight: null, consecutiveFailures: 0 }]),
  );
}
function apply(store, kind, lifts) {
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
        progress[target.lift] = { nextWeight: entry.weight, consecutiveFailures: failures };
      }
    }
  }
  return {
    sessions: [...store.sessions, { kind, lifts }],
    progress,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let store = { sessions: [], progress: emptyProgress() };
assert(nextWorkoutKind(store.sessions) === 'A', 'start A');

const five = [5, 5, 5, 5, 5];
store = apply(store, 'A', [
  { lift: 'squat', weight: 135, sets: five },
  { lift: 'bench', weight: 95, sets: five },
  { lift: 'row', weight: 95, sets: five },
]);
assert(nextWorkoutKind(store.sessions) === 'B', 'A→B');
assert(store.progress.squat.nextWeight === 140, 'squat +5');
assert(store.progress.bench.nextWeight === 97.5, 'bench +2.5');

store = apply(store, 'B', [
  { lift: 'squat', weight: 140, sets: five },
  { lift: 'ohp', weight: 65, sets: five },
  { lift: 'deadlift', weight: 185, sets: [5] },
]);
assert(nextWorkoutKind(store.sessions) === 'A', 'B→A');

// three failures → 10% deload
let p = emptyProgress();
p.bench = { nextWeight: 100, consecutiveFailures: 0 };
store = { sessions: [{ kind: 'B' }], progress: p };
for (let i = 0; i < 3; i++) {
  store = apply(store, 'A', [
    { lift: 'squat', weight: 135, sets: five },
    { lift: 'bench', weight: 100, sets: [5, 5, 5, 5, 3] },
    { lift: 'row', weight: 95, sets: five },
  ]);
}
assert(store.progress.bench.nextWeight === 90, `deload got ${store.progress.bench.nextWeight}`);
assert(store.progress.bench.consecutiveFailures === 0, 'failures reset');

console.log('ok: rotation A→B→A, increments, 10% deload after 3 failures');
