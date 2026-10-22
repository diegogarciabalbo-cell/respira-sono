/**
 * Cobertura da gravação: quanto da janela da sessão foi realmente capturado e onde estão as lacunas.
 * Tempo ausente nunca é tratado como silêncio; ele fica fora do denominador de qualquer métrica.
 */

export interface CoverageSegment {
  startAt: number;
  durationMs: number;
  status: 'complete' | 'recovered' | 'lost' | 'pending';
}

export interface CoverageInterruption {
  beginAt: number;
  endAt: number | null;
  reason: string;
}

export type GapReason =
  | 'silenced_by_system'
  | 'audio_session_interruption'
  | 'input_config_change'
  | 'media_services_reset'
  | 'capture_drift'
  | 'lost_segment'
  | 'app_terminated'
  | 'startup'
  | 'unknown'
  | (string & {});

export interface Gap {
  startAt: number;
  endAt: number;
  durationMs: number;
  reason: GapReason;
}

export interface Coverage {
  windowStart: number;
  windowEnd: number;
  wallMs: number;
  capturedMs: number;
  gapMs: number;
  gaps: Gap[];
  /** capturado / janela, entre 0 e 1 */
  coverage: number;
}

/** Lacunas menores que isto entre segmentos contínuos são jitter de relógio, não perda de áudio. */
export const CONTINUITY_TOLERANCE_MS = 250;

export function computeCoverage(input: {
  windowStart: number;
  windowEnd: number;
  segments: CoverageSegment[];
  interruptions?: CoverageInterruption[];
  drifts?: { at: number; lostMs: number }[];
  terminatedUnexpectedly?: boolean;
  toleranceMs?: number;
}): Coverage {
  const tol = input.toleranceMs ?? CONTINUITY_TOLERANCE_MS;
  const windowStart = input.windowStart;
  const windowEnd = Math.max(input.windowEnd, windowStart);
  const usable = input.segments
    .filter((s) => (s.status === 'complete' || s.status === 'recovered') && s.durationMs > 0)
    .map((s) => ({ start: Math.max(s.startAt, windowStart), end: Math.min(s.startAt + s.durationMs, windowEnd) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  // União dos intervalos (sobreposições por jitter não contam em dobro).
  const merged: { start: number; end: number }[] = [];
  for (const s of usable) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end + tol) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  const capturedMs = merged.reduce((acc, s) => acc + (s.end - s.start), 0);

  const lost = input.segments.filter((s) => s.status === 'lost');
  const holes: { start: number; end: number }[] = [];
  let cursor = windowStart;
  for (const m of merged) {
    if (m.start - cursor > tol) holes.push({ start: cursor, end: m.start });
    cursor = Math.max(cursor, m.end);
  }
  if (windowEnd - cursor > tol) holes.push({ start: cursor, end: windowEnd });

  const gaps: Gap[] = holes.map((h, i) => ({
    startAt: h.start,
    endAt: h.end,
    durationMs: h.end - h.start,
    reason: classifyGap(h, i === holes.length - 1 && h.end === windowEnd, i === 0 && h.start === windowStart, {
      interruptions: input.interruptions ?? [],
      drifts: input.drifts ?? [],
      lost,
      terminatedUnexpectedly: !!input.terminatedUnexpectedly,
    }),
  }));

  const wallMs = windowEnd - windowStart;
  return {
    windowStart,
    windowEnd,
    wallMs,
    capturedMs,
    gapMs: Math.max(0, wallMs - capturedMs),
    gaps,
    coverage: wallMs > 0 ? Math.min(1, capturedMs / wallMs) : 0,
  };
}

function overlaps(a: { start: number; end: number }, b0: number, b1: number) {
  return a.start < b1 && b0 < a.end;
}

function classifyGap(
  h: { start: number; end: number },
  isTrailing: boolean,
  isLeading: boolean,
  ctx: {
    interruptions: CoverageInterruption[];
    drifts: { at: number; lostMs: number }[];
    lost: CoverageSegment[];
    terminatedUnexpectedly: boolean;
  },
): GapReason {
  const pad = 2_000;
  const intr = ctx.interruptions.find((i) => overlaps(h, i.beginAt - pad, (i.endAt ?? Number.MAX_SAFE_INTEGER) + pad));
  if (intr) return intr.reason;
  if (ctx.lost.some((s) => overlaps(h, s.startAt - pad, s.startAt + pad + 1))) return 'lost_segment';
  if (ctx.drifts.some((d) => d.at >= h.start - pad && d.at <= h.end + pad)) return 'capture_drift';
  if (isTrailing && ctx.terminatedUnexpectedly) return 'app_terminated';
  if (isLeading) return 'startup';
  return 'unknown';
}

export const GAP_REASON_LABELS: Record<string, string> = {
  silenced_by_system: 'Microfone silenciado pelo sistema (ex.: ligação)',
  audio_session_interruption: 'Interrupção do sistema (ligação, alarme ou assistente)',
  input_config_change: 'Mudança da entrada de áudio',
  media_services_reset: 'Reinício dos serviços de áudio do sistema',
  capture_drift: 'Perda de amostras na captura',
  lost_segment: 'Trecho perdido após encerramento inesperado',
  app_terminated: 'App encerrado antes do fim da gravação',
  startup: 'Início da captura',
  unknown: 'Motivo não identificado',
};
