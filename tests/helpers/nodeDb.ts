/** Adaptador de node:sqlite para a interface DbLike (testes em Node, sem React Native). */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite');
import { DbLike } from '../../src/db/schema';

export function createTestDb(): DbLike {
  const db = new DatabaseSync(':memory:');
  const norm = (p: unknown[]) => p.map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : v));
  let depth = 0;
  return {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async runAsync(sql: string, ...params: unknown[]) {
      const r = db.prepare(sql).run(...norm(params));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      return db.prepare(sql).all(...norm(params)) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]) {
      return (db.prepare(sql).get(...norm(params)) ?? null) as T | null;
    },
    async withTransactionAsync(fn: () => Promise<void>) {
      if (depth > 0) return fn();
      depth++;
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
  };
}

/** Constrói um diário sintético (formato idêntico ao escrito pelo código nativo). */
export class JournalBuilder {
  lines: string[] = [];
  add(t: string, at: number, fields: Record<string, unknown> = {}) {
    this.lines.push(JSON.stringify({ t, at, ...fields }));
    return this;
  }
  start(at: number) {
    return this.add('session_start', at, {
      sessionId: 'sess_test01', platform: 'android', device: 'Teste X', sampleRate: 16000, bitRate: 32000,
      codec: 'aac-lc', container: 'adts', segmentSeconds: 300, battery: 90, freeBytes: 5e9,
    });
  }
  segment(idx: number, startAt: number, durationMs: number, levels: number[] = []) {
    this.add('segment_open', startAt, { idx, file: `seg_${String(idx).padStart(4, '0')}.aac`, startAt });
    return this.add('segment_close', startAt + durationMs, {
      idx, file: `seg_${String(idx).padStart(4, '0')}.aac`, startAt, durationMs, bytes: durationMs * 4,
      sampleRate: 16000, clippedRatio: 0, zeroRatio: 0, levels,
    });
  }
  openOnly(idx: number, startAt: number) {
    return this.add('segment_open', startAt, { idx, file: `seg_${String(idx).padStart(4, '0')}.aac`, startAt });
  }
  stop(at: number, reason = 'user') {
    return this.add('session_stop', at, { reason, battery: 70 });
  }
  text() {
    return this.lines.join('\n') + '\n';
  }
}
