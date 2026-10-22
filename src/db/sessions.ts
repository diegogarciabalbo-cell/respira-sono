import { computeCoverage, Gap } from '../domain/coverage';
import { applyProbes, reconstructSession, SegmentRecord } from '../domain/journal';
import { LevelTrack, SIGNAL_ANALYZER, summarizeSignal, SignalSummary } from '../domain/signal';
import { DbLike } from './schema';

export interface SessionRow {
  id: string;
  kind: 'night' | 'mic_test';
  status: 'recording' | 'completed' | 'interrupted' | 'failed';
  is_demo: number;
  keep: number;
  started_at: number;
  ended_at: number | null;
  stop_reason: string | null;
  platform: string | null;
  device: string | null;
  sample_rate: number | null;
  bit_rate: number | null;
  codec: string | null;
  container: string | null;
  segment_seconds: number | null;
  phone_position: string | null;
  battery_start: number | null;
  battery_end: number | null;
  free_bytes_start: number | null;
  dir: string | null;
  wall_ms: number | null;
  captured_ms: number | null;
  gap_ms: number | null;
  coverage: number | null;
  lost_segments: number;
  audio_deleted_at: number | null;
  reconciled_at: number | null;
  created_at: number;
}

export interface SegmentRow {
  id: number;
  session_id: string;
  idx: number;
  file: string;
  start_at: number;
  duration_ms: number;
  bytes: number;
  status: SegmentRecord['status'];
  clipped_ratio: number | null;
  zero_ratio: number | null;
  levels_json: string | null;
}

export interface GapRow {
  id: number;
  session_id: string;
  start_at: number;
  end_at: number;
  duration_ms: number;
  reason: string;
}

/** Operações de arquivo necessárias à reconciliação (injetadas para permitir testes). */
export interface SessionFiles {
  readJournal(dir: string): Promise<string | null>;
  probe(path: string): Promise<{ ok: boolean; durationMs: number; validBytes: number }>;
  join(dir: string, file: string): string;
  deleteDir(dir: string): Promise<void>;
}

export async function createSession(
  db: DbLike,
  s: { id: string; kind: 'night' | 'mic_test'; startedAt: number; dir: string; phonePosition?: string | null },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sessions (id, kind, status, started_at, dir, phone_position, created_at)
     VALUES (?, ?, 'recording', ?, ?, ?, ?)`,
    s.id, s.kind, s.startedAt, s.dir, s.phonePosition ?? null, Date.now(),
  );
  await audit(db, 'session_start', s.id);
}

export async function markFailed(db: DbLike, id: string, reason: string): Promise<void> {
  await db.runAsync(`UPDATE sessions SET status='failed', stop_reason=?, ended_at=? WHERE id=?`, reason, Date.now(), id);
}

/**
 * Reconstrói a sessão a partir do diário nativo e dos arquivos. Idempotente.
 * `isActive` indica que o gravador ainda está rodando esta sessão (não marcar como interrompida).
 */
export async function reconcileSession(
  db: DbLike,
  files: SessionFiles,
  id: string,
  opts: { isActive?: boolean; now?: number } = {},
): Promise<{ status: SessionRow['status']; gaps: Gap[]; signal: SignalSummary | null } | null> {
  const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id=?', id);
  if (!row || !row.dir) return null;
  if (row.audio_deleted_at) return { status: row.status, gaps: [], signal: null };

  const text = await files.readJournal(row.dir);
  if (text == null || text.trim() === '') {
    if (!opts.isActive) {
      await db.runAsync(
        `UPDATE sessions SET status='failed', stop_reason=COALESCE(stop_reason,'no_audio'), ended_at=COALESCE(ended_at, started_at),
         wall_ms=0, captured_ms=0, gap_ms=0, coverage=0, reconciled_at=? WHERE id=?`,
        opts.now ?? Date.now(), id,
      );
      return { status: 'failed', gaps: [], signal: null };
    }
    return { status: 'recording', gaps: [], signal: null };
  }

  let rec = reconstructSession(text);
  const pending = rec.segments.filter((s) => s.status === 'pending');
  if (pending.length && !opts.isActive) {
    const probes: Record<string, { ok: boolean; durationMs: number; validBytes: number }> = {};
    for (const s of pending) probes[s.file] = await files.probe(files.join(row.dir, s.file));
    rec = applyProbes(rec, probes);
  }

  const windowStart = rec.startedAt ?? row.started_at;
  const windowEnd = opts.isActive ? opts.now ?? Date.now() : rec.endedAt ?? windowStart;
  const segmentsForCoverage = opts.isActive ? rec.segments.filter((s) => s.status !== 'pending') : rec.segments;
  const cov = computeCoverage({
    windowStart,
    windowEnd,
    segments: segmentsForCoverage,
    interruptions: rec.interruptions,
    drifts: rec.drifts,
    terminatedUnexpectedly: !opts.isActive && rec.status === 'interrupted',
  });

  let status: SessionRow['status'];
  if (opts.isActive) status = 'recording';
  else if (rec.status === 'completed') status = cov.capturedMs > 0 ? 'completed' : 'failed';
  else status = cov.capturedMs > 0 ? 'interrupted' : 'failed';

  const tracks: LevelTrack[] = rec.segments
    .filter((s) => s.status === 'complete' && s.levels.length)
    .map((s) => ({ startAt: s.startAt, levels: s.levels }));
  const signal = tracks.length ? summarizeSignal(tracks) : null;
  const lost = rec.segments.filter((s) => s.status === 'lost').length;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE sessions SET status=?, ended_at=?, stop_reason=COALESCE(?, stop_reason), platform=?, device=?, sample_rate=?,
       bit_rate=?, codec=?, container=?, segment_seconds=?, battery_start=?, battery_end=?, free_bytes_start=?,
       wall_ms=?, captured_ms=?, gap_ms=?, coverage=?, lost_segments=?, reconciled_at=? WHERE id=?`,
      status,
      opts.isActive ? null : windowEnd,
      opts.isActive ? null : rec.stopReason ?? (rec.status === 'interrupted' ? 'app_terminated' : null),
      rec.meta.platform, rec.meta.device, rec.meta.sampleRate, rec.meta.bitRate, rec.meta.codec, rec.meta.container,
      rec.meta.segmentSeconds, rec.meta.batteryStart, rec.batteryEnd, rec.meta.freeBytesStart,
      Math.round(cov.wallMs), Math.round(cov.capturedMs), Math.round(cov.gapMs), cov.coverage, lost,
      opts.now ?? Date.now(), id,
    );
    await db.runAsync('DELETE FROM segments WHERE session_id=?', id);
    for (const s of rec.segments) {
      await db.runAsync(
        `INSERT INTO segments (session_id, idx, file, start_at, duration_ms, bytes, status, clipped_ratio, zero_ratio, levels_json)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        id, s.idx, s.file, Math.round(s.startAt), Math.round(s.durationMs), Math.round(s.bytes), s.status,
        s.clippedRatio, s.zeroRatio, s.levels.length ? JSON.stringify(s.levels) : null,
      );
    }
    await db.runAsync('DELETE FROM gaps WHERE session_id=?', id);
    for (const g of cov.gaps) {
      await db.runAsync(
        'INSERT INTO gaps (session_id, start_at, end_at, duration_ms, reason) VALUES (?,?,?,?,?)',
        id, Math.round(g.startAt), Math.round(g.endAt), Math.round(g.durationMs), g.reason,
      );
    }
    await db.runAsync("DELETE FROM session_events WHERE session_id=?", id);
    for (const r of rec.routeChanges) {
      await db.runAsync('INSERT INTO session_events (session_id, at, type, detail) VALUES (?,?,?,?)', id, r.at, 'route_change', r.input);
    }
    for (const e of rec.errors) {
      // Mensagens técnicas apenas; nunca conteúdo de áudio ou sintomas.
      await db.runAsync('INSERT INTO session_events (session_id, at, type, detail) VALUES (?,?,?,?)', id, e.at, 'error', e.code);
    }
    if (signal) {
      await db.runAsync(
        `INSERT OR REPLACE INTO acoustic_results (session_id, analyzer, analyzer_version, status, result_json, created_at)
         VALUES (?,?,?,?,?,?)`,
        id, SIGNAL_ANALYZER.id, SIGNAL_ANALYZER.version, 'available', JSON.stringify(signal), opts.now ?? Date.now(),
      );
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO acoustic_results (session_id, analyzer, analyzer_version, status, result_json, created_at)
       VALUES (?, 'snore-classifier', 'none', 'unavailable', NULL, ?)`,
      id, opts.now ?? Date.now(),
    );
  });

  return { status, gaps: cov.gaps, signal };
}

/** Na abertura do app: reconcilia sessões que ficaram "gravando" sem o gravador ativo. */
export async function recoverStaleSessions(db: DbLike, files: SessionFiles, activeSessionId: string | null): Promise<string[]> {
  const stale = await db.getAllAsync<{ id: string }>("SELECT id FROM sessions WHERE status='recording'");
  const recovered: string[] = [];
  for (const s of stale) {
    if (s.id === activeSessionId) continue;
    await reconcileSession(db, files, s.id, { isActive: false });
    await audit(db, 'session_recovered', s.id);
    recovered.push(s.id);
  }
  return recovered;
}

export async function listSessions(db: DbLike, kind: 'night' | 'mic_test' = 'night'): Promise<SessionRow[]> {
  return db.getAllAsync<SessionRow>('SELECT * FROM sessions WHERE kind=? ORDER BY started_at DESC', kind);
}

export async function getSession(db: DbLike, id: string) {
  const session = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id=?', id);
  if (!session) return null;
  const segments = await db.getAllAsync<SegmentRow>('SELECT * FROM segments WHERE session_id=? ORDER BY idx', id);
  const gaps = await db.getAllAsync<GapRow>('SELECT * FROM gaps WHERE session_id=? ORDER BY start_at', id);
  const signalRow = await db.getFirstAsync<{ result_json: string | null }>(
    `SELECT result_json FROM acoustic_results WHERE session_id=? AND analyzer=? ORDER BY created_at DESC LIMIT 1`,
    id, SIGNAL_ANALYZER.id,
  );
  const signal = signalRow?.result_json ? (JSON.parse(signalRow.result_json) as SignalSummary) : null;
  return { session, segments, gaps, signal };
}

/** Exclui a sessão: arquivos de áudio primeiro, depois os registros (cascata). */
export async function deleteSession(db: DbLike, files: SessionFiles, id: string): Promise<void> {
  const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id=?', id);
  if (!row) return;
  if (row.status === 'recording') throw new Error('Encerre a gravação antes de apagar.');
  const req = await db.runAsync('INSERT INTO deletion_requests (scope, target, requested_at) VALUES (?,?,?)', 'session', id, Date.now());
  if (row.dir) await files.deleteDir(row.dir);
  await db.runAsync('DELETE FROM sessions WHERE id=?', id);
  await db.runAsync('UPDATE deletion_requests SET completed_at=? WHERE id=?', Date.now(), req.lastInsertRowId);
  await audit(db, 'session_deleted', id);
}

/** Apaga só o áudio (retenção), mantendo o resumo. */
export async function deleteSessionAudio(db: DbLike, files: SessionFiles, id: string): Promise<void> {
  const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id=?', id);
  if (!row || row.status === 'recording') return;
  if (row.dir) await files.deleteDir(row.dir);
  await db.runAsync('UPDATE sessions SET audio_deleted_at=? WHERE id=?', Date.now(), id);
  await audit(db, 'session_audio_deleted', id);
}

export async function setKeep(db: DbLike, id: string, keep: boolean) {
  await db.runAsync('UPDATE sessions SET keep=? WHERE id=?', keep ? 1 : 0, id);
}

export async function audit(db: DbLike, action: string, target?: string | null) {
  await db.runAsync('INSERT INTO audit_log (at, action, target) VALUES (?,?,?)', Date.now(), action, target ?? null);
}
