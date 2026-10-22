/**
 * Esquema local (SQLite). Migrações aplicadas em ordem e registradas em PRAGMA user_version.
 * Não existe tabela de "diagnósticos": resultados acústicos guardam analisador, versão e status.
 */
export interface DbLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

export const MIGRATIONS: string[] = [
  /* 1 */ `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS profile (
    id TEXT PRIMARY KEY CHECK (id = 'local'),
    age_range TEXT,                 -- '18-29' | '30-44' | '45-59' | '60+'
    goal TEXT,
    prior_snoring TEXT,             -- autorrelato
    apnea_diagnosis TEXT,           -- 'yes' | 'no' | 'unknown'
    prescribed_treatment TEXT,      -- 'none' | 'cpap' | 'oral_appliance' | 'other'
    symptoms_json TEXT,             -- sintomas autorrelatados (ReportedSymptoms)
    partner_report TEXT,
    onboarding_completed_at INTEGER,
    source TEXT NOT NULL DEFAULT 'self_report',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,             -- 'terms' | 'microphone' | 'cloud_sync' | 'sharing' | 'research' | 'room_others_notice'
    version TEXT NOT NULL,
    granted INTEGER NOT NULL CHECK (granted IN (0,1)),
    at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_consents_kind ON consents(kind, at);

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('night','mic_test')),
    status TEXT NOT NULL CHECK (status IN ('recording','completed','interrupted','failed')),
    is_demo INTEGER NOT NULL DEFAULT 0,
    keep INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    stop_reason TEXT,
    platform TEXT,
    device TEXT,
    sample_rate INTEGER,
    bit_rate INTEGER,
    codec TEXT,
    container TEXT,
    segment_seconds INTEGER,
    phone_position TEXT,            -- condição declarada (comparabilidade entre noites)
    battery_start INTEGER,
    battery_end INTEGER,
    free_bytes_start INTEGER,
    dir TEXT,
    wall_ms INTEGER,
    captured_ms INTEGER,
    gap_ms INTEGER,
    coverage REAL,
    lost_segments INTEGER NOT NULL DEFAULT 0,
    audio_deleted_at INTEGER,
    reconciled_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);

  CREATE TABLE IF NOT EXISTS segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    file TEXT NOT NULL,
    start_at INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    bytes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('complete','recovered','lost','pending')),
    clipped_ratio REAL,
    zero_ratio REAL,
    levels_json TEXT,
    UNIQUE(session_id, idx)
  );

  CREATE TABLE IF NOT EXISTS gaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    start_at INTEGER NOT NULL,
    end_at INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    reason TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    at INTEGER NOT NULL,
    type TEXT NOT NULL,             -- 'route_change' | 'error' | 'interruption'
    detail TEXT
  );

  CREATE TABLE IF NOT EXISTS acoustic_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    analyzer TEXT NOT NULL,         -- ex.: 'signal-activity'
    analyzer_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('available','unavailable','experimental')),
    result_json TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(session_id, analyzer, analyzer_version)
  );

  CREATE TABLE IF NOT EXISTS diary_entries (
    night TEXT PRIMARY KEY,         -- YYYY-MM-DD (noite que começa nesta data)
    bed_time TEXT,
    wake_time TEXT,
    rested INTEGER CHECK (rested BETWEEN 1 AND 5),
    sleepiness INTEGER CHECK (sleepiness BETWEEN 1 AND 5),
    exercises_done INTEGER,
    alcohol INTEGER,
    nasal_congestion INTEGER,
    other_factors_json TEXT,
    prescribed_treatment_used INTEGER,
    partner_report TEXT,
    observed_pauses INTEGER,
    recurrent_choking INTEGER,
    drowsy_driving INTEGER,
    source TEXT NOT NULL DEFAULT 'self_report',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS program_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id TEXT NOT NULL,
    program_version INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active','paused','finished','stopped'))
  );

  CREATE TABLE IF NOT EXISTS exercise_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id TEXT NOT NULL,
    exercise_version INTEGER NOT NULL,
    content_status TEXT NOT NULL,   -- status do conteúdo no momento (ex.: 'draft' em demonstração)
    completed_at INTEGER NOT NULL,
    reps_done INTEGER,
    seconds_done INTEGER,
    stopped_early INTEGER NOT NULL DEFAULT 0,
    discomfort INTEGER CHECK (discomfort BETWEEN 0 AND 10),
    discomfort_note TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    action TEXT NOT NULL,           -- sem áudio, sintomas ou tokens
    target TEXT
  );

  CREATE TABLE IF NOT EXISTS deletion_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope TEXT NOT NULL,            -- 'session' | 'all_local' | 'account'
    target TEXT,
    requested_at INTEGER NOT NULL,
    completed_at INTEGER
  );
  `,
];

export async function migrate(db: DbLike): Promise<number> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
  return version;
}
