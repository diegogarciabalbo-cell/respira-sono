import { DbLike } from './schema';

export async function recordCompletion(
  db: DbLike,
  c: {
    exerciseId: string;
    version: number;
    contentStatus: string;
    repsDone?: number | null;
    secondsDone?: number | null;
    stoppedEarly?: boolean;
    discomfort?: number | null;
    discomfortNote?: string | null;
  },
) {
  if (c.discomfort != null && (c.discomfort < 0 || c.discomfort > 10)) throw new Error('Desconforto deve ser de 0 a 10');
  await db.runAsync(
    `INSERT INTO exercise_completions (exercise_id, exercise_version, content_status, completed_at, reps_done, seconds_done, stopped_early, discomfort, discomfort_note)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    c.exerciseId, c.version, c.contentStatus, Date.now(), c.repsDone ?? null, c.secondsDone ?? null, c.stoppedEarly ? 1 : 0,
    c.discomfort ?? null, c.discomfortNote ?? null,
  );
}

export async function completionsSince(db: DbLike, since: number) {
  return db.getAllAsync<{ exercise_id: string; completed_at: number; stopped_early: number; discomfort: number | null; content_status: string }>(
    'SELECT exercise_id, completed_at, stopped_early, discomfort, content_status FROM exercise_completions WHERE completed_at >= ? ORDER BY completed_at DESC',
    since,
  );
}

/** Dias distintos com pelo menos um exercício concluído nos últimos `days` dias. */
export function adherenceDays(completions: { completed_at: number }[], days: number, now: number): { done: number; of: number } {
  const start = now - days * 24 * 3600 * 1000;
  const set = new Set<string>();
  for (const c of completions) {
    if (c.completed_at < start) continue;
    const d = new Date(c.completed_at);
    set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return { done: set.size, of: days };
}
