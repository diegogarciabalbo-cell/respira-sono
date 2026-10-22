import { DbLike } from './schema';

export interface DiaryEntry {
  night: string;
  bed_time: string | null;
  wake_time: string | null;
  rested: number | null;
  sleepiness: number | null;
  exercises_done: number | null;
  alcohol: number | null;
  nasal_congestion: number | null;
  other_factors_json: string | null;
  prescribed_treatment_used: number | null;
  partner_report: string | null;
  observed_pauses: number | null;
  recurrent_choking: number | null;
  drowsy_driving: number | null;
  source: string;
  created_at: number;
  updated_at: number;
}

export type DiaryInput = Partial<Omit<DiaryEntry, 'night' | 'source' | 'created_at' | 'updated_at'>>;

const FIELDS: (keyof DiaryInput)[] = [
  'bed_time', 'wake_time', 'rested', 'sleepiness', 'exercises_done', 'alcohol', 'nasal_congestion',
  'other_factors_json', 'prescribed_treatment_used', 'partner_report', 'observed_pauses', 'recurrent_choking', 'drowsy_driving',
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateDiary(input: DiaryInput): string[] {
  const errs: string[] = [];
  for (const k of ['bed_time', 'wake_time'] as const) {
    const v = input[k];
    if (v != null && v !== '' && !TIME_RE.test(v)) errs.push(`Horário inválido em ${k === 'bed_time' ? 'deitar' : 'levantar'} (use HH:MM)`);
  }
  for (const k of ['rested', 'sleepiness'] as const) {
    const v = input[k];
    if (v != null && (!Number.isInteger(v) || v < 1 || v > 5)) errs.push('Escalas vão de 1 a 5');
  }
  if (input.partner_report && input.partner_report.length > 500) errs.push('Relato muito longo (máx. 500 caracteres)');
  return errs;
}

export async function upsertDiary(db: DbLike, night: string, input: DiaryInput): Promise<void> {
  const errs = validateDiary(input);
  if (errs.length) throw new Error(errs.join('; '));
  const now = Date.now();
  const existing = await db.getFirstAsync<DiaryEntry>('SELECT * FROM diary_entries WHERE night=?', night);
  const merged: DiaryInput = { ...(existing ?? {}), ...input };
  const values = FIELDS.map((f) => (merged[f] === '' ? null : merged[f] ?? null));
  if (existing) {
    await db.runAsync(
      `UPDATE diary_entries SET ${FIELDS.map((f) => `${f}=?`).join(', ')}, updated_at=? WHERE night=?`,
      ...values, now, night,
    );
  } else {
    await db.runAsync(
      `INSERT INTO diary_entries (night, ${FIELDS.join(', ')}, created_at, updated_at) VALUES (?, ${FIELDS.map(() => '?').join(', ')}, ?, ?)`,
      night, ...values, now, now,
    );
  }
}

export async function getDiary(db: DbLike, night: string) {
  return db.getFirstAsync<DiaryEntry>('SELECT * FROM diary_entries WHERE night=?', night);
}

export async function listDiary(db: DbLike, limit = 60) {
  return db.getAllAsync<DiaryEntry>('SELECT * FROM diary_entries ORDER BY night DESC LIMIT ?', limit);
}
