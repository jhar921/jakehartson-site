CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bar_weight_lbs REAL NOT NULL DEFAULT 45,
  plates_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE progress (
  lift TEXT PRIMARY KEY,
  next_weight REAL,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('A', 'B')),
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE session_lifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  lift TEXT NOT NULL,
  prescribed_weight REAL,
  prescribed_sets INTEGER NOT NULL,
  prescribed_reps INTEGER NOT NULL,
  actual_weight REAL NOT NULL,
  sets_json TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE (session_id, lift)
);

CREATE TABLE draft (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  kind TEXT NOT NULL CHECK (kind IN ('A', 'B')),
  entries_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE vault_queue (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'acked')),
  enqueued_at TEXT NOT NULL,
  acked_at TEXT
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (id, bar_weight_lbs, plates_json, updated_at)
VALUES (1, 45, '[45,35,25,10,5,2.5]', '1970-01-01T00:00:00.000Z');

INSERT INTO progress (lift, next_weight, consecutive_failures) VALUES
  ('squat', NULL, 0),
  ('bench', NULL, 0),
  ('row', NULL, 0),
  ('ohp', NULL, 0),
  ('deadlift', NULL, 0);

INSERT INTO meta (key, value) VALUES
  ('schema_version', '1'),
  ('local_import_done', '0');
