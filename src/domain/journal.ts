/**
 * Leitura do diário nativo de gravação (JSON Lines) e reconstrução da sessão.
 * Funções puras: sem dependência de React Native, testáveis em Node.
 */

export type JournalEvent = { t: string; at: number; [k: string]: unknown };

export interface SegmentRecord {
  idx: number;
  file: string;
  startAt: number;
  durationMs: number;
  bytes: number;
  /** complete = fechado normalmente; recovered = recuperado após falha; lost = ilegível; pending = precisa de verificação */
  status: 'complete' | 'recovered' | 'lost' | 'pending';
  clippedRatio: number | null;
  zeroRatio: number | null;
  levels: number[];
}

export interface InterruptionRecord {
  beginAt: number;
  endAt: number | null;
  reason: string;
}

export interface SessionMeta {
  sessionId: string | null;
  platform: string | null;
  device: string | null;
  osVersion: string | null;
  sampleRate: number | null;
  bitRate: number | null;
  codec: string | null;
  container: string | null;
  segmentSeconds: number | null;
  batteryStart: number | null;
  freeBytesStart: number | null;
}

export interface ReconstructedSession {
  meta: SessionMeta;
  startedAt: number | null;
  endedAt: number | null;
  /** completed: houve session_stop; interrupted: diário termina sem session_stop (processo encerrado). */
  status: 'completed' | 'interrupted' | 'empty';
  stopReason: string | null;
  batteryEnd: number | null;
  segments: SegmentRecord[];
  interruptions: InterruptionRecord[];
  drifts: { at: number; lostMs: number }[];
  routeChanges: { at: number; input: string }[];
  errors: { at: number; code: string; message: string }[];
  lastEventAt: number | null;
  malformedLines: number;
}

export function parseJournal(text: string): { events: JournalEvent[]; malformed: number } {
  const events: JournalEvent[] = [];
  let malformed = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj.t === 'string' && typeof obj.at === 'number') events.push(obj);
      else malformed++;
    } catch {
      // Última linha pode estar truncada se o processo morreu durante a escrita.
      malformed++;
    }
  }
  return { events, malformed };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : v == null ? null : String(v));

export function reconstructSession(text: string): ReconstructedSession {
  const { events, malformed } = parseJournal(text);
  const out: ReconstructedSession = {
    meta: {
      sessionId: null, platform: null, device: null, osVersion: null, sampleRate: null, bitRate: null,
      codec: null, container: null, segmentSeconds: null, batteryStart: null, freeBytesStart: null,
    },
    startedAt: null,
    endedAt: null,
    status: 'empty',
    stopReason: null,
    batteryEnd: null,
    segments: [],
    interruptions: [],
    drifts: [],
    routeChanges: [],
    errors: [],
    lastEventAt: null,
    malformedLines: malformed,
  };
  const open = new Map<number, SegmentRecord>();
  let hasStop = false;

  for (const e of events) {
    out.lastEventAt = Math.max(out.lastEventAt ?? 0, e.at);
    switch (e.t) {
      case 'session_start':
        out.startedAt = e.at;
        out.meta = {
          sessionId: str(e.sessionId),
          platform: str(e.platform),
          device: str(e.device),
          osVersion: str(e.osVersion),
          sampleRate: num(e.sampleRate),
          bitRate: num(e.bitRate),
          codec: str(e.codec),
          container: str(e.container),
          segmentSeconds: num(e.segmentSeconds),
          batteryStart: num(e.battery),
          freeBytesStart: num(e.freeBytes),
        };
        break;
      case 'segment_open': {
        const idx = num(e.idx);
        if (idx == null) break;
        open.set(idx, {
          idx,
          file: str(e.file) ?? '',
          startAt: num(e.startAt) ?? e.at,
          durationMs: 0,
          bytes: 0,
          status: 'pending',
          clippedRatio: null,
          zeroRatio: null,
          levels: [],
        });
        break;
      }
      case 'segment_close': {
        const idx = num(e.idx);
        if (idx == null) break;
        const prev = open.get(idx);
        open.delete(idx);
        out.segments.push({
          idx,
          file: str(e.file) ?? prev?.file ?? '',
          startAt: num(e.startAt) ?? prev?.startAt ?? e.at,
          durationMs: Math.max(0, num(e.durationMs) ?? 0),
          bytes: num(e.bytes) ?? 0,
          status: 'complete',
          clippedRatio: num(e.clippedRatio),
          zeroRatio: num(e.zeroRatio),
          levels: Array.isArray(e.levels) ? (e.levels as unknown[]).filter((x): x is number => typeof x === 'number') : [],
        });
        break;
      }
      case 'interruption_begin':
        out.interruptions.push({ beginAt: e.at, endAt: null, reason: str(e.reason) ?? 'unknown' });
        break;
      case 'interruption_end': {
        const pending = [...out.interruptions].reverse().find((i) => i.endAt == null);
        if (pending) pending.endAt = e.at;
        break;
      }
      case 'capture_drift':
        out.drifts.push({ at: e.at, lostMs: num(e.lostMs) ?? 0 });
        break;
      case 'route_change':
        out.routeChanges.push({ at: e.at, input: str(e.input) ?? 'unknown' });
        break;
      case 'error':
        out.errors.push({ at: e.at, code: str(e.code) ?? 'unknown', message: str(e.message) ?? '' });
        break;
      case 'session_stop':
        hasStop = true;
        out.endedAt = e.at;
        out.stopReason = str(e.reason);
        out.batteryEnd = num(e.battery);
        break;
    }
  }

  // Segmentos abertos sem fechamento: precisam ser inspecionados no arquivo (recuperação).
  for (const seg of open.values()) out.segments.push(seg);
  out.segments.sort((a, b) => a.idx - b.idx);

  if (out.startedAt == null && out.segments.length === 0) out.status = 'empty';
  else out.status = hasStop ? 'completed' : 'interrupted';

  if (!hasStop) {
    // Sem session_stop o fim real é desconhecido. Usamos o último evento confiável registrado;
    // segmentos recuperados podem estender esse limite depois da inspeção dos arquivos.
    out.endedAt = out.lastEventAt;
  }
  return out;
}

/** Aplica o resultado da inspeção dos arquivos aos segmentos pendentes. */
export function applyProbes(
  session: ReconstructedSession,
  probes: Record<string, { ok: boolean; durationMs: number; validBytes: number }>,
): ReconstructedSession {
  const segments = session.segments.map((s) => {
    if (s.status !== 'pending') return s;
    const p = probes[s.file];
    if (!p || !p.ok || p.durationMs <= 0) return { ...s, status: 'lost' as const, durationMs: 0 };
    return { ...s, status: 'recovered' as const, durationMs: p.durationMs, bytes: p.validBytes };
  });
  let endedAt = session.endedAt;
  if (session.status === 'interrupted') {
    for (const s of segments) {
      if (s.status === 'recovered' || s.status === 'complete') {
        endedAt = Math.max(endedAt ?? 0, s.startAt + s.durationMs);
      }
    }
  }
  return { ...session, segments, endedAt };
}
