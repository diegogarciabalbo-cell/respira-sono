import { nextSteps } from '../src/domain/guidance';
import { compareFactor } from '../src/domain/insights';
import { buildNightSummary, buildReportHtml, SNORE_ANALYSIS_UNAVAILABLE } from '../src/domain/report';
import { summarizeSignal } from '../src/domain/signal';
import { bytesPerHour, RECORDING_PRESETS, sessionsToPurge } from '../src/domain/storage';
import { computeCoverage } from '../src/domain/coverage';

const T0 = Date.UTC(2026, 9, 21, 2, 0, 0);

describe('sinal (camada B)', () => {
  test('silêncio digital é inutilizável e sai do denominador', () => {
    const levels = [...Array(100).fill(-120), ...Array(100).fill(-55)];
    const s = summarizeSignal([{ startAt: T0, levels }]);
    expect(s.analyzedSeconds).toBe(200);
    expect(s.usableSeconds).toBe(100);
    expect(s.digitalSilenceSeconds).toBe(100);
    expect(s.quality).toBe('limitada');
  });

  test('atividade relativa ao ruído de fundo e trechos destacados', () => {
    const levels = Array(600).fill(-60);
    for (let i = 300; i < 330; i++) levels[i] = -35;
    const s = summarizeSignal([{ startAt: T0, levels }]);
    expect(s.noiseFloorDbfs).toBe(-60);
    expect(s.activeSeconds).toBe(30);
    expect(s.activeRatio).toBeCloseTo(30 / 600);
    expect(s.highlights).toHaveLength(1);
    expect(s.highlights[0].startAt).toBeGreaterThanOrEqual(T0 + 270_000);
  });

  test('sem dados => qualidade insuficiente, sem números inventados', () => {
    const s = summarizeSignal([]);
    expect(s.quality).toBe('insuficiente');
    expect(s.activeRatio).toBeNull();
    expect(s.noiseFloorDbfs).toBeNull();
  });

  test('timeline mantém lacunas como null (sem preenchimento)', () => {
    const s = summarizeSignal([
      { startAt: T0, levels: Array(60).fill(-50) },
      { startAt: T0 + 5 * 60_000, levels: Array(60).fill(-50) },
    ]);
    expect(s.timeline.filter((p) => p.dbfs === null).length).toBeGreaterThanOrEqual(3);
  });
});

describe('orientação baseada em sintomas', () => {
  test('sonolência ao dirigir gera orientação de segurança e avaliação', () => {
    const steps = nextSteps({ drowsyDriving: true });
    expect(steps.map((s) => s.id)).toEqual(expect.arrayContaining(['safety-driving', 'evaluate-sleep']));
  });

  test('dificuldade respiratória intensa agora => atendimento imediato primeiro', () => {
    expect(nextSteps({ severeBreathingNow: true })[0].level).toBe('urgent');
  });

  test('regras não aceitam dados acústicos: noite silenciosa não remove orientação', () => {
    // A assinatura da função só recebe sintomas; garantimos que o resultado independe do áudio.
    expect(nextSteps.length).toBe(1);
    const steps = nextSteps({ observedPauses: true });
    expect(steps.some((s) => s.id === 'evaluate-sleep')).toBe(true);
  });

  test('tratamento prescrito: nunca sugere suspender', () => {
    const steps = nextSteps({ diagnosedApnea: 'yes', prescribedTreatment: 'cpap' });
    const text = steps.map((s) => s.body).join(' ').toLowerCase();
    expect(text).toContain('não ajusta nem substitui');
    expect(text).not.toMatch(/suspend|pare de usar|reduza/);
  });

  test('textos não contêm termos diagnósticos proibidos', () => {
    const all = [
      nextSteps({ observedPauses: true, recurrentChoking: true, daytimeSleepiness: 5, drowsyDriving: true, severeBreathingNow: true }),
      nextSteps({}),
    ].flat().map((s) => s.title + s.body).join(' ');
    expect(all).not.toMatch(/IAH|AHI|probabilidade|gravidade|você tem apneia|curad/i);
  });
});

describe('resumo e relatório', () => {
  const cov = computeCoverage({ windowStart: T0, windowEnd: T0 + 3600_000, segments: [{ startAt: T0, durationMs: 3000_000, status: 'complete' }] });
  const summary = buildNightSummary({
    sessionId: 's1', startedAt: T0, endedAt: T0 + 3600_000, status: 'completed', stopReason: 'user', device: 'X',
    sampleRate: 16000, bitRate: 32000, codec: 'aac-lc', batteryStart: 90, batteryEnd: 80, lostSegments: 0,
    coverage: cov, signal: null, snoreAnalysis: { status: 'unavailable' }, diary: null,
    steps: nextSteps({ observedPauses: true }), appVersion: '0.1.0',
  });

  test('quatro blocos distintos e aviso de análise indisponível', () => {
    expect(summary.title).toBe('Seu resumo da noite');
    expect(summary.blocks.map((b) => b.key)).toEqual(['recording', 'acoustic', 'reported', 'next']);
    expect(summary.blocks[1].lines).toContain(SNORE_ANALYSIS_UNAVAILABLE);
    expect(summary.intro).toContain('não confirma nem exclui apneia');
    expect(summary.intro).toContain('podem justificar uma avaliação');
  });

  test('relatório: não é laudo, traz versões, escapa HTML e respeita seções escolhidas', () => {
    const html = buildReportHtml({
      periodLabel: '21/10/2026', generatedAt: T0, nights: [summary],
      includeSections: { recording: true, acoustic: true, reported: false, next: true },
    });
    expect(html).toContain('não é laudo médico');
    expect(html).toContain('signal-activity@');
    expect(html).not.toContain('Sintomas e hábitos informados por você');
    const evil = buildNightSummary({ ...{
      sessionId: 's', startedAt: T0, endedAt: T0, status: 'completed', stopReason: null, device: null, sampleRate: null, bitRate: null,
      codec: null, batteryStart: null, batteryEnd: null, lostSegments: 0, coverage: cov, signal: null,
      snoreAnalysis: { status: 'unavailable' }, steps: [], appVersion: '0' }, diary: { partnerReport: '<script>x</script>' } });
    const h2 = buildReportHtml({ periodLabel: 'x', generatedAt: T0, nights: [evil], includeSections: { recording: true, acoustic: true, reported: true, next: true } });
    expect(h2).not.toContain('<script>');
  });
});

describe('associações e armazenamento', () => {
  test('poucos dados: não afirma diferença', () => {
    const r = compareFactor([{ date: 'a', factors: { alcohol: true }, outcome: 2 }], 'alcohol', { factor: 'álcool', outcome: 'descanso' });
    expect(r.enoughData).toBe(false);
    expect(r.statement).toContain('Ainda não há noites suficientes');
  });

  test('dados suficientes: observação sem causalidade e alerta de condições diferentes', () => {
    const n = (alc: boolean, out: number, cond: string) => ({ date: 'd', factors: { alcohol: alc }, outcome: out, conditionKey: cond });
    const r = compareFactor([n(true, 2, 'a'), n(true, 2, 'a'), n(true, 3, 'b'), n(false, 4, 'a'), n(false, 4, 'a'), n(false, 5, 'a')], 'alcohol', {
      factor: 'álcool', outcome: 'descanso',
    });
    expect(r.enoughData).toBe(true);
    expect(r.statement).toContain('não indica causa');
    expect(r.mixedConditions).toBe(true);
  });

  test('estimativa de armazenamento do preset padrão (~15 MB/h)', () => {
    const b = bytesPerHour(RECORDING_PRESETS.padrao);
    expect(b / 1024 / 1024).toBeGreaterThan(13);
    expect(b / 1024 / 1024).toBeLessThan(16);
  });

  test('retenção respeita "manter" e "nunca apagar"', () => {
    const now = T0 + 40 * 86400_000;
    const s = [
      { id: 'old', startedAt: T0, endedAt: T0, keep: false },
      { id: 'kept', startedAt: T0, endedAt: T0, keep: true },
      { id: 'new', startedAt: now, endedAt: now, keep: false },
    ];
    expect(sessionsToPurge(s, 30, now)).toEqual(['old']);
    expect(sessionsToPurge(s, null, now)).toEqual([]);
  });
});
