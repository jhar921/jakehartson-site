/**
 * Domain checks against the shipped module (no browser).
 * Run: npm run check   (or: node scripts/test-domain.mjs)
 */
import {
  WORKOUTS,
  applyCompletedWorkout,
  applyStartingWeights,
  createEmptyStore,
  doneAsPrescribed,
  draftToEntries,
  ensureDraft,
  firstIncompleteLiftIndex,
  formatPlatePlan,
  importJson,
  isLoadable,
  isValidDraft,
  liftHit,
  needsStartingWeights,
  nearestLoadableAtOrBelow,
  nextWorkoutKind,
  parseStore,
  platePlan,
  prescriptionWhy,
  renderVaultNote,
  roundToPlate,
  uniqueVaultFilename,
  warmupSets,
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
assert(bad([{ kind: "C", completedAt: "2026-11-05", lifts: [] }]) === 0, "unknown workout kind rejected");
assert(bad([{ kind: "A", completedAt: "2026-11-05", lifts: [{ lift: "curl", weight: 20, sets: five }] }]) === 0, "unknown lift rejected");
assert(bad([{ kind: "A", completedAt: "2026-11-05", lifts: [{ lift: "ohp", weight: 20, sets: five }] }]) === 0, "lift not in that workout rejected");
assert(bad([{ kind: "A", completedAt: "2026-11-05", lifts: [{ lift: "squat", weight: null, sets: five }] }]) === 0, "null weight rejected");
assert(bad([{ kind: "A", completedAt: "2026-11-05", lifts: [{ lift: "squat", weight: 1e400, sets: five }] }]) === 0, "non-finite weight rejected");
assert(bad([{ kind: "A", completedAt: "2026-11-05", lifts: [{ lift: "squat", weight: 135, sets: "5,5" }] }]) === 0, "non-array sets rejected");
assert(bad([{ kind: "A", completedAt: "2026-11-05", lifts: [{ lift: "squat", weight: 135, sets: [5, "<b>"] }] }]) === 0, "non-numeric reps rejected");
assert(bad([{ kind: "A", completedAt: { x: 1 }, lifts: [] }]) === 0, "non-string completedAt rejected");
assert(bad([null, 7, "x"]) === 0, "non-object sessions rejected");
assert(bad([{ kind: "B", lifts: B(140, 65, 185) }]) === 0, "missing completedAt rejected");
assert(bad([{ kind: "B", completedAt: "2026-11-05T12:00:00Z", lifts: B(140, 65, 185) }]) === 1, "valid session kept");
let threw = false;
try { importJson(JSON.stringify({ version: 99, sessions: [], progress: {} })); } catch { threw = true; }
assert(threw, "unknown version rejected");

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

// --- Phase 1 additions ---

// v1 backup migrates in place to v2 and fills prescribed fields from logged actuals
const v1 = {
  version: 1,
  sessions: [
    {
      id: "sess-1",
      kind: "A",
      completedAt: "2026-11-05T12:00:00Z",
      lifts: A(135, 95, 95),
    },
  ],
  progress: {
    squat: { nextWeight: 140, consecutiveFailures: 0 },
    bench: { nextWeight: 97.5, consecutiveFailures: 0 },
    row: { nextWeight: 97.5, consecutiveFailures: 0 },
    ohp: { nextWeight: null, consecutiveFailures: 0 },
    deadlift: { nextWeight: null, consecutiveFailures: 0 },
  },
  draft: null,
};
const migrated = importJson(JSON.stringify(v1));
assert(migrated.version === 2, "v1 import becomes version 2");
assert(migrated.sessions[0].lifts[0].prescribedWeight === 135, "v1 prescribedWeight filled from weight");
assert(migrated.sessions[0].lifts[0].prescribedSets === 5 && migrated.sessions[0].lifts[0].prescribedReps === 5, "v1 prescribed sets/reps filled");
assert(migrated.settings.barWeightLbs === 45, "migrated settings default bar 45");
assert(migrated.settings.plates.join() === "45,35,25,10,5,2.5", "migrated settings default plates");
assert(migrated.sessions[0].id === "sess-1", "v1 session id kept");

// Official StrongLifts 225 squat warmup
const squat225 = warmupSets("squat", 225).map((s) => `${s.weight}x${s.reps}`);
assert(
  squat225.join() === "45x5,45x5,95x5,135x5,185x5",
  `225 squat warmup official example (got ${squat225.join(" ")})`,
);

const squat95 = warmupSets("squat", 95);
assert(squat95.length <= 2, `95 squat has no long ramp (got ${squat95.map((s) => s.weight).join(",")})`);
assert(squat95.every((s) => s.weight < 95), "95 squat warmup stays below work weight");

const squat45 = warmupSets("squat", 45);
assert(squat45.length === 0, "empty-bar work day has no warmup");

const squat55 = warmupSets("squat", 55);
assert(squat55.length === 0, "work at bar+10 has no warmup");

for (const [lift, work] of [
  ["squat", 95],
  ["squat", 135],
  ["squat", 185],
  ["squat", 225],
  ["squat", 275],
  ["bench", 115],
  ["ohp", 85],
  ["deadlift", 185],
  ["deadlift", 225],
  ["row", 135],
  ["row", 95],
]) {
  const sets = warmupSets(lift, work);
  assert(sets.every((s) => s.weight < work), `${lift} ${work}: no warmup >= work weight`);
  assert(sets.every((s) => s.reps === 5), `${lift} ${work}: warmup reps are 5`);
  for (let i = 1; i < sets.length; i++) {
    if (sets[i].weight === sets[i - 1].weight) {
      assert(sets[i].weight === 45, `${lift} ${work}: only empty bar may repeat`);
      continue;
    }
    const jump = sets[i].weight - sets[i - 1].weight;
    assert(jump > 0 && jump <= 50, `${lift} ${work}: jump ${jump} from ${sets[i - 1].weight} to ${sets[i].weight} should be 1-50`);
  }
  if (sets.length) {
    const lastJump = work - sets[sets.length - 1].weight;
    assert(lastJump > 0 && lastJump <= 50, `${lift} ${work}: final jump to work is ${lastJump}, want 1-50`);
  }
}

assert(warmupSets("deadlift", 95).length === 0, "deadlift at 95 has no warmup at or above work");
const dl225 = warmupSets("deadlift", 225).map((s) => s.weight);
assert(dl225[0] >= 95, `deadlift starts off the floor (got ${dl225.join(",")})`);
assert(!dl225.includes(45) || dl225[0] !== 45, "deadlift does not start with empty bar");

// Plate math
const p225 = platePlan(225);
assert(p225.loadable && !p225.flagged, "225 is loadable on a 45 bar");
assert(
  p225.eachSide.length === 1 && p225.eachSide[0].plate === 45 && p225.eachSide[0].count === 2,
  `225 is 2 x 45 each side (got ${JSON.stringify(p225.eachSide)})`,
);
assert(formatPlatePlan(p225) === "2 x 45 each side", `225 plate copy (got ${formatPlatePlan(p225)})`);

const p135 = platePlan(135);
assert(p135.eachSide.length === 1 && p135.eachSide[0].plate === 45 && p135.eachSide[0].count === 1, "135 is 1 x 45 each side");

const p45 = platePlan(45);
assert(p45.loadable && p45.eachSide.length === 0, "bar only is empty bar");
assert(formatPlatePlan(p45) === "Empty bar", "empty bar copy");

assert(!isLoadable(97.5), "97.5 needs 1.25s each side, not in the default set");
assert(isLoadable(100), "100 is loadable (25 + 2.5 each side)");
assert(isLoadable(95), "95 is loadable (25 each side)");
const odd = platePlan(133);
assert(odd.flagged && odd.weight === 130 && isLoadable(odd.weight), `133 flags nearest below 130 (got ${odd.weight})`);
assert(nearestLoadableAtOrBelow(133) === 130, "nearest loadable below 133 is 130");
assert(platePlan(97.5).flagged && platePlan(97.5).weight === 95, "97.5 flags nearest loadable 95");
const withFraction = platePlan(97.5, 45, [45, 35, 25, 10, 5, 2.5, 1.25]);
assert(withFraction.loadable && !withFraction.flagged, "97.5 is loadable once 1.25s are in settings");

const noSmall = platePlan(97.5, 45, [45, 25, 10, 5]);
assert(noSmall.flagged && noSmall.weight === 95, `97.5 without 2.5s falls back to 95 (got ${noSmall.weight})`);

// Starting weights are not invented
let fresh = createEmptyStore();
assert(needsStartingWeights(fresh), "fresh store needs starting weights");
assert(prescriptionWhy(fresh, "squat") === "Set a starting weight", "no history why-line");
const startBad = applyStartingWeights(fresh, { squat: 135, bench: 95, row: 95, ohp: 65 });
assert(!startBad.ok, "starting weights refuse a missing lift");
const started = applyStartingWeights(fresh, { squat: 135, bench: 95, row: 95, ohp: 65, deadlift: 185 });
assert(started.ok && started.store.progress.squat.nextWeight === 135, "starting weights saved");
assert(!needsStartingWeights(started.store), "starting weights clear the first-run gate");
assert(prescriptionWhy(started.store, "ohp") === "Starting weight", "set but unused lift says Starting weight");


// Prescription why-lines and done-as-prescribed
let guided = applyStartingWeights(createEmptyStore(), {
  squat: 135, bench: 95, row: 95, ohp: 65, deadlift: 185,
}).store;
guided = applyCompletedWorkout(guided, "A", A(135, 95, 95));
assert(prescriptionWhy(guided, "squat") === "Last time 5/5/5/5/5 at 135", "success why-line");
assert(guided.progress.squat.nextWeight === 140, "done as prescribed then +5");

const doneSq = doneAsPrescribed(WORKOUTS.A[0], 140);
assert(doneSq.sets.join() === "5,5,5,5,5" && doneSq.weight === 140, "Done writes prescribed sets at prescribed weight");

let miss = applyCompletedWorkout(guided, "B", B(140, 65, 185, [5, 5, 5, 5, 4]));
assert(prescriptionWhy(miss, "ohp") === "Repeat, 1 miss in a row", "one miss why-line");
miss = applyCompletedWorkout(miss, "A", A(145, 97.5, 97.5));
miss = applyCompletedWorkout(miss, "B", B(150, 65, 190, [5, 5, 5, 5, 4]));
assert(prescriptionWhy(miss, "ohp") === "Repeat, 2 misses in a row", "two miss why-line");
miss = applyCompletedWorkout(miss, "A", A(155, 100, 100));
miss = applyCompletedWorkout(miss, "B", B(160, 65, 195, [5, 5, 5, 5, 4]));
assert(miss.progress.ohp.nextWeight === 57.5, "third OHP miss deloads 65 -> 57.5");
assert(prescriptionWhy(miss, "ohp") === "Deload after 3 misses", "deload why-line");

// Override: heavier success advances from the heavier load; extra reps do not skip an increment
let over = applyStartingWeights(createEmptyStore(), {
  squat: 135, bench: 95, row: 95, ohp: 65, deadlift: 185,
}).store;
over = applyCompletedWorkout(over, "A", [
  { lift: "squat", prescribedWeight: 135, prescribedSets: 5, prescribedReps: 5, weight: 140, sets: five, notes: "" },
  { lift: "bench", prescribedWeight: 95, prescribedSets: 5, prescribedReps: 5, weight: 95, sets: [6, 6, 6, 6, 6], notes: "" },
  { lift: "row", prescribedWeight: 95, prescribedSets: 5, prescribedReps: 5, weight: 95, sets: five, notes: "" },
]);
assert(over.progress.squat.nextWeight === 145, "heavier override success increments from 140");
assert(over.progress.bench.nextWeight === 97.5, "extra reps still add only 2.5");
over = applyCompletedWorkout(over, "B", [
  { lift: "squat", prescribedWeight: 145, prescribedSets: 5, prescribedReps: 5, weight: 150, sets: [5, 5, 5, 5, 3], notes: "" },
  { lift: "ohp", prescribedWeight: 65, prescribedSets: 5, prescribedReps: 5, weight: 65, sets: five, notes: "" },
  { lift: "deadlift", prescribedWeight: 185, prescribedSets: 1, prescribedReps: 5, weight: 185, sets: [5], notes: "" },
]);
assert(over.progress.squat.nextWeight === 150 && over.progress.squat.consecutiveFailures === 1, "miss at heavier override repeats the heavier load");

// Draft first-incomplete uses confirmed, so a prefilled prescription is not already done
const draftReady = ensureDraft(started.store);
assert(draftReady.draft.entries.squat.confirmed === false, "new draft lifts start unconfirmed");
assert(firstIncompleteLiftIndex("A", draftReady.draft) === 0, "unconfirmed first lift is current");
const parsedDraft = draftToEntries("A", {
  kind: "A",
  entries: {
    squat: { weight: 135, sets: five, notes: "", confirmed: true },
    bench: { weight: 95, sets: five, notes: "", confirmed: true },
    row: { weight: 95, sets: five, notes: "", confirmed: true },
  },
}, started.store.progress);
assert(parsedDraft.ok && parsedDraft.lifts[0].prescribedWeight === 135, "draftToEntries keeps prescribed weight from progress");

// Vault note
const note = renderVaultNote({
  id: "abc-123",
  kind: "A",
  completedAt: "2026-11-11T16:00:00Z",
  lifts: [
    { lift: "squat", prescribedWeight: 135, prescribedSets: 5, prescribedReps: 5, weight: 135, sets: five, notes: "" },
    { lift: "bench", prescribedWeight: 95, prescribedSets: 5, prescribedReps: 5, weight: 95, sets: [5, 5, 5, 5, 4], notes: "last set grind" },
    { lift: "row", prescribedWeight: 95, prescribedSets: 5, prescribedReps: 5, weight: 95, sets: five, notes: "" },
  ],
});
assert(note.filename === "2026-11-11 A workout.md", `vault filename (got ${note.filename})`);
assert(note.markdown.startsWith("---\ntype: workout\ndate: 2026-11-11\nsession: A\nworkout_id: abc-123\n"), "vault frontmatter style");
assert(note.markdown.includes("| Bench Press | 95 lb 5x5 | 95 lb | 5/5/5/5/4 | miss |"), "vault body table includes miss");
assert(note.markdown.includes("result: miss"), "frontmatter records miss");
assert(liftHit({ prescribedSets: 5, prescribedReps: 5, sets: five }) === true, "hit helper");
assert(uniqueVaultFilename("2026-11-11 A workout.md", new Set(["2026-11-11 A workout.md"])) === "2026-11-11 A workout-2.md", "same-day filename collision");
assert(uniqueVaultFilename("2026-11-11 A workout.md", new Set(["2026-11-11 A workout.md", "2026-11-11 A workout-2.md"])) === "2026-11-11 A workout-3.md", "second collision increments");

console.log(`ok: ${passed} assertions (rotation, increments, 2.5 lb deload rounding, import/draft validation, warmup, plates, prescription, v1 migrate, vault note)`);
