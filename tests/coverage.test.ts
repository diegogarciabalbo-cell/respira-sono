import { computeCoverage } from '../src/domain/coverage';
import { applyProbes, reconstructSession } from '../src/domain/journal';
import { JournalBuilder } from './helpers/nodeDb';

const T0 = Date.UTC(2026, 9, 21, 2, 0, 0); // 23h em São Paulo
const MIN = 60_000;
const H = 60 * MIN;

describe('cobertura e lacunas', () => {
  test('segmentos contínuos sem lacunas => cobertura ~100%', () => {
    const segs = Array.from({ length: 96 }, (_, i) => ({ startAt: T0 + i * 5 * MIN, durationMs: 5 * MIN, status: 'complete' as const }));
    const c = computeCoverage({ windowStart: T0, windowEnd: T0 + 8 * H, segments: segs });
    expect(c.capturedMs).toBe(8 * H);
    expect(c.gaps).toHaveLength(0);
    expect(c.coverage).toBe(1);
  });

  test('jitter abaixo da tolerância entre segmentos não vira lacuna', () => {
    const segs = [
      { startAt: T0, durationMs: 5 * MIN, status: 'complete' as const },
      { startAt: T0 + 5 * MIN + 120, durationMs: 5 * MIN, status: 'complete' as const },
    ];
    const c = computeCoverage({ windowStart: T0, windowEnd: T0 + 10 * MIN + 120, segments: segs });
    expect(c.gaps).toHaveLength(0);
  });

  test('interrupção vira lacuna com motivo, e o tempo ausente fica fora do capturado', () => {
    const segs = [
      { startAt: T0, durationMs: 60 * MIN, status: 'complete' as const },
      { startAt: T0 + 70 * MIN, durationMs: 50 * MIN, status: 'complete' as const },
    ];
    const c = computeCoverage({
      windowStart: T0,
      windowEnd: T0 + 120 * MIN,
      segments: segs,
      interruptions: [{ beginAt: T0 + 60 * MIN, endAt: T0 + 70 * MIN, reason: 'audio_session_interruption' }],
    });
    expect(c.capturedMs).toBe(110 * MIN);
    expect(c.gapMs).toBe(10 * MIN);
    expect(c.gaps).toEqual([{ startAt: T0 + 60 * MIN, endAt: T0 + 70 * MIN, durationMs: 10 * MIN, reason: 'audio_session_interruption' }]);
    expect(c.coverage).toBeCloseTo(110 / 120);
  });

  test('segmento perdido não conta como capturado', () => {
    const segs = [
      { startAt: T0, durationMs: 5 * MIN, status: 'complete' as const },
      { startAt: T0 + 5 * MIN, durationMs: 0, status: 'lost' as const },
    ];
    const c = computeCoverage({ windowStart: T0, windowEnd: T0 + 10 * MIN, segments: segs, terminatedUnexpectedly: true });
    expect(c.capturedMs).toBe(5 * MIN);
    expect(c.gaps[0].reason).toBe('lost_segment');
  });

  test('segmentos sobrepostos não contam em dobro', () => {
    const segs = [
      { startAt: T0, durationMs: 10 * MIN, status: 'complete' as const },
      { startAt: T0 + 5 * MIN, durationMs: 10 * MIN, status: 'complete' as const },
    ];
    const c = computeCoverage({ windowStart: T0, windowEnd: T0 + 15 * MIN, segments: segs });
    expect(c.capturedMs).toBe(15 * MIN);
  });
});

describe('reconstrução do diário', () => {
  test('sessão encerrada normalmente', () => {
    const j = new JournalBuilder().start(T0);
    for (let i = 0; i < 3; i++) j.segment(i, T0 + i * 5 * MIN, 5 * MIN, [-50, -48]);
    j.stop(T0 + 15 * MIN);
    const r = reconstructSession(j.text());
    expect(r.status).toBe('completed');
    expect(r.segments).toHaveLength(3);
    expect(r.segments.every((s) => s.status === 'complete')).toBe(true);
    expect(r.meta.sampleRate).toBe(16000);
    expect(r.batteryEnd).toBe(70);
  });

  test('processo encerrado à força: última linha truncada, segmento aberto recuperado pelo arquivo', () => {
    const j = new JournalBuilder().start(T0).segment(0, T0, 5 * MIN).openOnly(1, T0 + 5 * MIN);
    const text = j.text() + '{"t":"segment_cl'; // escrita interrompida
    let r = reconstructSession(text);
    expect(r.status).toBe('interrupted');
    expect(r.malformedLines).toBe(1);
    expect(r.segments[1].status).toBe('pending');

    r = applyProbes(r, { 'seg_0001.aac': { ok: true, durationMs: 3 * MIN, validBytes: 1000 } });
    expect(r.segments[1].status).toBe('recovered');
    expect(r.endedAt).toBe(T0 + 8 * MIN);

    const c = computeCoverage({ windowStart: r.startedAt!, windowEnd: r.endedAt!, segments: r.segments, terminatedUnexpectedly: true });
    expect(c.capturedMs).toBe(8 * MIN);
    expect(c.gaps).toHaveLength(0);
  });

  test('segmento aberto ilegível (iOS .m4a não finalizado) vira perdido, sem inventar duração', () => {
    const j = new JournalBuilder().start(T0).segment(0, T0, 5 * MIN).openOnly(1, T0 + 5 * MIN);
    const r = applyProbes(reconstructSession(j.text()), { 'seg_0001.aac': { ok: false, durationMs: 0, validBytes: 0 } });
    expect(r.segments[1].status).toBe('lost');
    expect(r.segments[1].durationMs).toBe(0);
  });

  test('diário vazio', () => {
    expect(reconstructSession('').status).toBe('empty');
  });
});
