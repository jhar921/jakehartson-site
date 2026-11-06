/**
 * Domain checks against the shipped module (no browser).
 * Run: npm run check   (or: node scripts/test-domain.mjs)
 */
import {
  WORKOUTS,
  applyCompletedWorkout,
  createEmptyStore,
  ensureDraft,
  importJson,
  isValidDraft,
  nextWorkoutKind,
  parseStore,
  roundToPlate,
} from "../public/lifts-domain.js";

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
}
const five = [5, 5, 5, 5, 5];
const A = (sq, be, ro, beSets = five) => [
  { lift: "squat", weight: sq, sets: five, notes: "" },
  { lift: "bench", weight: be, sets: beSets, notes: "" },
  { lift: "row", weight: ro, sets: five, notes: "" },
];
const B = (sq, oh, dl, ohSets = five) => [
  { lift: "squat", weight: sq, sets: five, notes: "" },
  { lift: "ohp", weight: oh, sets: ohSets, notes: "" },
  { lift: "deadlift", weight: dl, sets: [5], notes: "" },
];

// Rotation + increments (+5 squat/deadlift, +2.5 upper body)
let s = createEmptyStore();
assert(nextWorkoutKind(s) === "A", "fresh store starts on A");
assert(WORKOUTS.A.map((t) => `${t.lift}${t.sets}x${t.reps}`).join() === "squat5x5,bench5x5,row5x5", "Workout A shape");
assert(WORKOUTS.B.map((t) => `${t.lift}${t.sets}x${t.reps}`).join() === "squat5x5,ohp5x5,deadlift1x5", "Workout B shape");
s = applyCompletedWorkout(s, "A", A(135, 95, 95));
assert(nextWorkoutKind(s) === "B", "A -> B");
assert(s.progress.squat.nextWeight === 140, "squat +5");
assert(s.progress.bench.nextWeight === 97.5 && s.progress.row.nextWeight === 97.5, "bench/row +2.5");
s = applyCompletedWorkout(s, "B", B(140, 65, 185, [5, 5, 5, 5, 4]));
assert(nextWorkoutKind(s) === "A", "B -> A");
assert(s.progress.ohp.nextWeight === 65 && s.progress.ohp.consecutiveFailures === 1, "OHP miss repeats weight");
assert(s.progress.deadlift.nextWeight === 190, "deadlift +5");
assert(s.progress.squat.nextWeight === 145, "squat +5 again");

// 10% deload after 3 consecutive failures, rounded down to 2.5 lb plate steps
assert(roundToPlate(97.5 * 0.9) === 87.5, "97.5 deload -> 87.5");
assert(roundToPlate(135 * 0.9) === 120, "135 deload -> 120");
assert(roundToPlate(100 * 0.9) === 90, "100 deload -> 90");
for (const [start, want] of [[97.5, 87.5], [135, 120], [65, 57.5]]) {
  let d = { ...createEmptyStore(), sessions: [{ kind: "B", lifts: [] }] };
  for (let i = 0; i < 3; i++) d = applyCompletedWorkout(d, "A", A(135, start, 95, [5, 5, 5, 5, 3]));
  assert(d.progress.bench.nextWeight === want, `bench ${start} x3 fails -> ${want} (got ${d.progress.bench.nextWeight})`);
  assert(d.progress.bench.consecutiveFailures === 0, "failure streak resets after deload");
}

// Import / load validation
const good = JSON.parse(JSON.stringify({ ...s, draft: null }));
const ok = importJson(JSON.stringify(good));
assert(ok.sessions.length === 2, "valid backup keeps sessions");
const bad = (sessions) => parseStore({ version: 1, sessions, progress: {} }).sessions.length;
assert(bad([{ id: "x", kind: "<img src=x onerror=alert(1)>", completedAt: "2026-01-01", lifts: [] }]) === 0, "XSS kind rejected");
assert(bad([{ kind: "C", lifts: [] }]) === 0, "unknown workout kind rejected");
assert(bad([{ kind: "A", lifts: [{ lift: "curl", weight: 20, sets: five }] }]) === 0, "unknown lift rejected");
assert(bad([{ kind: "A", lifts: [{ lift: "ohp", weight: 20, sets: five }] }]) === 0, "lift not in that workout rejected");
assert(bad([{ kind: "A", lifts: [{ lift: "squat", weight: null, sets: five }] }]) === 0, "null weight rejected");
assert(bad([{ kind: "A", lifts: [{ lift: "squat", weight: 1e400, sets: five }] }]) === 0, "non-finite weight rejected");
assert(bad([{ kind: "A", lifts: [{ lift: "squat", weight: 135, sets: "5,5" }] }]) === 0, "non-array sets rejected");
assert(bad([{ kind: "A", lifts: [{ lift: "squat", weight: 135, sets: [5, "<b>"] }] }]) === 0, "non-numeric reps rejected");
assert(bad([{ kind: "A", completedAt: { x: 1 }, lifts: [] }]) === 0, "non-string completedAt rejected");
assert(bad([null, 7, "x"]) === 0, "non-object sessions rejected");
assert(bad([{ kind: "B", lifts: B(140, 65, 185) }]) === 1, "valid session kept");
let threw = false;
try { importJson(JSON.stringify({ version: 2, sessions: [], progress: {} })); } catch { threw = true; }
assert(threw, "wrong version rejected");

// Draft validation
const draftOf = (entries, kind = "A") => ({ kind, entries });
const goodEntries = {
  squat: { weight: 135, sets: [5, null, null, null, null], notes: "" },
  bench: { weight: null, sets: [null, null, null, null, null], notes: "" },
  row: { weight: 95, sets: [null, null, null, null, null], notes: "" },
};
assert(isValidDraft(draftOf(goodEntries)), "valid draft accepted");
assert(!isValidDraft(draftOf(goodEntries, "<x>")), "bad draft kind rejected");
assert(!isValidDraft(draftOf({ squat: goodEntries.squat })), "draft missing lifts rejected");
assert(!isValidDraft(draftOf({ ...goodEntries, row: { weight: "95", sets: [], notes: "" } })), "string weight / short sets rejected");
assert(!isValidDraft(draftOf({ ...goodEntries, bench: { weight: 95, sets: [5, 5, 5, 5, "<b>"] } })), "bad rep in draft rejected");
assert(!isValidDraft(draftOf({ ...goodEntries, bench: null })), "null entry rejected");
const loaded = parseStore({ version: 1, sessions: [], progress: {}, draft: draftOf({ squat: 1 }) });
assert(loaded.draft === null, "malformed draft dropped on load");
const rebuilt = ensureDraft(loaded);
assert(rebuilt.draft.kind === "A" && rebuilt.draft.entries.row.sets.length === 5, "draft rebuilt cleanly");
const imported = importJson(JSON.stringify({ version: 1, sessions: [], progress: {}, draft: draftOf(goodEntries) }));
assert(imported.draft === null, "import always resets draft");

console.log(`ok: ${passed} assertions (rotation, increments, 2.5 lb deload rounding, import/draft validation)`);
