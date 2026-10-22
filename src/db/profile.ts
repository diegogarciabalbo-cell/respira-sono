import { ReportedSymptoms } from '../domain/guidance';
import { audit } from './sessions';
import { DbLike } from './schema';

export interface Profile {
  age_range: string | null;
  goal: string | null;
  prior_snoring: string | null;
  apnea_diagnosis: 'yes' | 'no' | 'unknown' | null;
  prescribed_treatment: 'none' | 'cpap' | 'oral_appliance' | 'other' | null;
  symptoms: ReportedSymptoms;
  partner_report: string | null;
  onboarding_completed_at: number | null;
}

export const CONSENT_VERSIONS = {
  terms: '2026-10-21',
  microphone: '2026-10-21',
  room_others_notice: '2026-10-21',
  cloud_sync: '2026-10-21',
  sharing: '2026-10-21',
  research: '2026-10-21',
} as const;

export type ConsentKind = keyof typeof CONSENT_VERSIONS;

export async function getProfile(db: DbLike): Promise<Profile | null> {
  const r = await db.getFirstAsync<any>("SELECT * FROM profile WHERE id='local'");
  if (!r) return null;
  return {
    age_range: r.age_range,
    goal: r.goal,
    prior_snoring: r.prior_snoring,
    apnea_diagnosis: r.apnea_diagnosis,
    prescribed_treatment: r.prescribed_treatment,
    symptoms: r.symptoms_json ? JSON.parse(r.symptoms_json) : {},
    partner_report: r.partner_report,
    onboarding_completed_at: r.onboarding_completed_at,
  };
}

export async function saveProfile(db: DbLike, p: Partial<Profile>): Promise<void> {
  const cur = (await getProfile(db)) ?? {
    age_range: null, goal: null, prior_snoring: null, apnea_diagnosis: null, prescribed_treatment: null,
    symptoms: {}, partner_report: null, onboarding_completed_at: null,
  };
  const n = { ...cur, ...p, symptoms: { ...cur.symptoms, ...(p.symptoms ?? {}) } };
  if (n.age_range === 'under18') throw new Error('O RESPIRA Sono é destinado a maiores de 18 anos nesta versão.');
  await db.runAsync(
    `INSERT INTO profile (id, age_range, goal, prior_snoring, apnea_diagnosis, prescribed_treatment, symptoms_json, partner_report, onboarding_completed_at, updated_at)
     VALUES ('local',?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET age_range=excluded.age_range, goal=excluded.goal, prior_snoring=excluded.prior_snoring,
       apnea_diagnosis=excluded.apnea_diagnosis, prescribed_treatment=excluded.prescribed_treatment, symptoms_json=excluded.symptoms_json,
       partner_report=excluded.partner_report, onboarding_completed_at=excluded.onboarding_completed_at, updated_at=excluded.updated_at`,
    n.age_range, n.goal, n.prior_snoring, n.apnea_diagnosis, n.prescribed_treatment, JSON.stringify(n.symptoms),
    n.partner_report, n.onboarding_completed_at, Date.now(),
  );
}

export async function recordConsent(db: DbLike, kind: ConsentKind, granted: boolean): Promise<void> {
  await db.runAsync('INSERT INTO consents (kind, version, granted, at) VALUES (?,?,?,?)', kind, CONSENT_VERSIONS[kind], granted ? 1 : 0, Date.now());
  await audit(db, granted ? 'consent_granted' : 'consent_revoked', kind);
}

export async function currentConsents(db: DbLike): Promise<Record<ConsentKind, boolean>> {
  const rows = await db.getAllAsync<{ kind: ConsentKind; granted: number; version: string }>(
    `SELECT c.kind, c.granted, c.version FROM consents c
     JOIN (SELECT kind, MAX(id) AS mid FROM consents GROUP BY kind) m ON m.mid = c.id`,
  );
  const out = Object.fromEntries(Object.keys(CONSENT_VERSIONS).map((k) => [k, false])) as Record<ConsentKind, boolean>;
  // Consentimento só vale para a versão vigente do texto.
  for (const r of rows) out[r.kind] = r.granted === 1 && r.version === CONSENT_VERSIONS[r.kind];
  return out;
}

export async function getPref<T>(db: DbLike, key: string, fallback: T): Promise<T> {
  const r = await db.getFirstAsync<{ value_json: string }>('SELECT value_json FROM preferences WHERE key=?', key);
  return r ? (JSON.parse(r.value_json) as T) : fallback;
}

export async function setPref(db: DbLike, key: string, value: unknown): Promise<void> {
  await db.runAsync(
    `INSERT INTO preferences (key, value_json, updated_at) VALUES (?,?,?)
     ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`,
    key, JSON.stringify(value), Date.now(),
  );
}

/** Exportação de dados locais (sem áudio) em JSON, por ação explícita do usuário. */
export async function exportLocalData(db: DbLike) {
  const tables = ['profile', 'preferences', 'consents', 'sessions', 'segments', 'gaps', 'acoustic_results', 'diary_entries', 'exercise_completions', 'program_enrollments'];
  const out: Record<string, unknown[]> = {};
  for (const t of tables) out[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  return { exportedAt: new Date().toISOString(), format: 'respira-sono-export@1', note: 'Arquivos de áudio não incluídos.', data: out };
}

/** Apaga todos os dados locais. Os arquivos de áudio devem ser apagados pelo chamador antes. */
export async function wipeLocalData(db: DbLike) {
  await db.withTransactionAsync(async () => {
    for (const t of ['segments', 'gaps', 'session_events', 'acoustic_results', 'sessions', 'diary_entries', 'exercise_completions', 'program_enrollments', 'consents', 'preferences', 'profile', 'audit_log']) {
      await db.execAsync(`DELETE FROM ${t}`);
    }
    await db.runAsync('INSERT INTO deletion_requests (scope, requested_at, completed_at) VALUES (?,?,?)', 'all_local', Date.now(), Date.now());
  });
}
