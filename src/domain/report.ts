/**
 * "Seu resumo da noite" e relatório exportável.
 * Quatro blocos separados: gravação · achados acústicos · relato do usuário · próximos passos.
 * Não é laudo médico; sempre declara origem das medidas, cobertura, limitações e versões.
 */
import { Coverage, GAP_REASON_LABELS } from './coverage';
import { formatClock, formatDate, formatDuration, formatPercent } from './format';
import { GUIDANCE_RULES, NextStep } from './guidance';
import { SIGNAL_ANALYZER, SignalSummary } from './signal';

export const REPORT_DISCLAIMER =
  'Esta gravação não confirma nem exclui apneia. Duração gravada não é tempo de sono. ' +
  'Os níveis sonoros são relativos ao microfone do aparelho (dBFS) e não são medidas calibradas.';

export const SNORE_ANALYSIS_UNAVAILABLE = 'Análise automática de ronco ainda indisponível.';

export interface DiarySnapshot {
  bedTime?: string | null;
  wakeTime?: string | null;
  rested?: number | null;
  sleepiness?: number | null;
  alcohol?: boolean | null;
  nasalCongestion?: boolean | null;
  exercisesDone?: boolean | null;
  prescribedTreatmentUsed?: boolean | null;
  partnerReport?: string | null;
}

export interface NightSummaryInput {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  status: 'completed' | 'interrupted' | 'recording' | 'failed';
  stopReason: string | null;
  device: string | null;
  sampleRate: number | null;
  bitRate: number | null;
  codec: string | null;
  batteryStart: number | null;
  batteryEnd: number | null;
  lostSegments: number;
  coverage: Coverage;
  signal: SignalSummary | null;
  snoreAnalysis: { status: 'unavailable' } | { status: 'experimental'; analyzer: string; version: string; minutes: number };
  diary: DiarySnapshot | null;
  steps: NextStep[];
  appVersion: string;
}

export interface SummaryBlock {
  key: 'recording' | 'acoustic' | 'reported' | 'next';
  title: string;
  lines: string[];
  notes: string[];
}

export interface NightSummary {
  title: 'Seu resumo da noite';
  intro: string;
  blocks: SummaryBlock[];
  disclaimer: string;
  versions: { app: string; signalAnalyzer: string; guidanceRules: string; guidanceReview: string };
}

const STOP_REASON_LABELS: Record<string, string> = {
  user: 'encerrada por você',
  user_notification: 'encerrada pela notificação',
  low_storage: 'interrompida por pouco espaço livre',
  max_duration: 'encerrada pelo limite de duração',
  mic_unavailable: 'microfone indisponível',
  mic_busy: 'microfone em uso por outro app',
  mic_lost: 'microfone perdido durante a gravação',
  capture_error: 'erro de captura',
  write_failed: 'falha ao salvar o áudio',
};

export function buildNightSummary(i: NightSummaryInput): NightSummary {
  const rec: string[] = [
    `Início ${formatClock(i.startedAt)} · fim ${formatClock(i.endedAt)} (${formatDate(i.startedAt)})`,
    `Áudio capturado: ${formatDuration(i.coverage.capturedMs)} de ${formatDuration(i.coverage.wallMs)} (${formatPercent(i.coverage.coverage)})`,
  ];
  const recNotes: string[] = [];
  if (i.coverage.gaps.length) {
    rec.push(`Lacunas: ${i.coverage.gaps.length} (${formatDuration(i.coverage.gapMs)} sem áudio)`);
    for (const g of i.coverage.gaps.slice(0, 6)) {
      recNotes.push(`${formatClock(g.startAt)}–${formatClock(g.endAt)}: ${GAP_REASON_LABELS[g.reason] ?? g.reason}`);
    }
  }
  if (i.status === 'interrupted') {
    recNotes.push('A gravação não foi encerrada normalmente. Mostramos apenas o que foi salvo; o período posterior não foi gravado.');
  }
  if (i.lostSegments > 0) recNotes.push(`${i.lostSegments} trecho(s) não puderam ser recuperados.`);
  if (i.stopReason && STOP_REASON_LABELS[i.stopReason]) rec.push(`Sessão ${STOP_REASON_LABELS[i.stopReason]}.`);
  if (i.batteryStart != null && i.batteryEnd != null && i.batteryStart >= 0 && i.batteryEnd >= 0) {
    rec.push(`Bateria: ${i.batteryStart}% → ${i.batteryEnd}%`);
  }
  if (i.signal) {
    rec.push(`Qualidade do sinal: ${i.signal.quality}`);
    recNotes.push(...i.signal.qualityNotes);
  }

  const ac: string[] = [];
  const acNotes: string[] = [];
  if (i.snoreAnalysis.status === 'unavailable') {
    ac.push(SNORE_ANALYSIS_UNAVAILABLE);
  } else {
    ac.push(`Sons classificados como ronco (experimental): cerca de ${Math.round(i.snoreAnalysis.minutes)} min`);
    acNotes.push('Classificação experimental, ainda sem validação. Pode incluir sons de outra pessoa ou do ambiente.');
  }
  if (i.signal && i.signal.usableSeconds > 0) {
    ac.push(
      `Atividade sonora acima do ruído de fundo: ${formatDuration(i.signal.activeSeconds * 1000)} ` +
        `(${formatPercent(i.signal.activeRatio)} do tempo analisável)`,
    );
    ac.push(`Tempo analisável: ${formatDuration(i.signal.usableSeconds * 1000)}`);
    if (i.signal.highlights.length) ac.push(`${i.signal.highlights.length} trecho(s) destacados para ouvir`);
    acNotes.push('“Atividade sonora” inclui qualquer som (fala, ventilador, TV, animais, outra pessoa). Não é contagem de ronco nem de eventos respiratórios.');
  }

  const rep: string[] = [];
  const d = i.diary;
  if (d) {
    if (d.bedTime || d.wakeTime) rep.push(`Horários informados: deitou ${d.bedTime ?? '—'} · levantou ${d.wakeTime ?? '—'}`);
    if (d.rested != null) rep.push(`Descanso percebido: ${d.rested}/5`);
    if (d.sleepiness != null) rep.push(`Sonolência: ${d.sleepiness}/5`);
    const f: string[] = [];
    if (d.alcohol) f.push('álcool');
    if (d.nasalCongestion) f.push('congestão nasal');
    if (d.exercisesDone) f.push('exercícios feitos');
    if (d.prescribedTreatmentUsed) f.push('tratamento prescrito usado');
    if (f.length) rep.push(`Fatores informados: ${f.join(', ')}`);
    if (d.partnerReport) rep.push(`Relato de quem divide o quarto: “${d.partnerReport}”`);
  } else {
    rep.push('Nenhum registro no diário para esta noite.');
  }

  const next = i.steps.map((s) => `${s.title}: ${s.body}`);

  const hasSymptomStep = i.steps.some((s) => s.level !== 'info');
  return {
    title: 'Seu resumo da noite',
    intro:
      'Registramos sua noite. Você pode ouvir os trechos destacados e acompanhar a evolução. Esta gravação não confirma nem exclui apneia.' +
      (hasSymptomStep ? ' Os sintomas que você relatou podem justificar uma avaliação profissional.' : ''),
    blocks: [
      { key: 'recording', title: 'Qualidade e duração da gravação', lines: rec, notes: recNotes },
      { key: 'acoustic', title: 'Achados acústicos disponíveis', lines: ac, notes: acNotes },
      { key: 'reported', title: 'Sintomas e hábitos informados por você', lines: rep, notes: [] },
      { key: 'next', title: 'Próximos passos', lines: next, notes: GUIDANCE_RULES.reviewStatus === 'draft' ? [GUIDANCE_RULES.note] : [] },
    ],
    disclaimer: REPORT_DISCLAIMER,
    versions: {
      app: i.appVersion,
      signalAnalyzer: `${SIGNAL_ANALYZER.id}@${SIGNAL_ANALYZER.version}`,
      guidanceRules: GUIDANCE_RULES.version,
      guidanceReview: GUIDANCE_RULES.reviewStatus === 'approved' ? 'revisadas' : 'provisórias, aguardando revisão clínica',
    },
  };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML do relatório exportável (convertido em PDF no aparelho). */
export function buildReportHtml(input: {
  periodLabel: string;
  generatedAt: number;
  nights: NightSummary[];
  includeSections: { recording: boolean; acoustic: boolean; reported: boolean; next: boolean };
}): string {
  const keys = (Object.keys(input.includeSections) as SummaryBlock['key'][]).filter((k) => input.includeSections[k]);
  const nightsHtml = input.nights
    .map((n, idx) => {
      const blocks = n.blocks
        .filter((b) => keys.includes(b.key))
        .map(
          (b) =>
            `<section><h3>${esc(b.title)}</h3><ul>${b.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` +
            (b.notes.length ? `<p class="note">${b.notes.map(esc).join('<br/>')}</p>` : '') +
            `</section>`,
        )
        .join('');
      return `<article><h2>Noite ${idx + 1}</h2>${blocks}</article>`;
    })
    .join('');
  const v = input.nights[0]?.versions;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<style>
body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#10233f;margin:28px;font-size:12px;line-height:1.45}
h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;border-bottom:1px solid #c9d6e8;padding-bottom:4px;margin-top:22px}
h3{font-size:12.5px;margin:12px 0 4px;color:#1f4f8a} ul{margin:0;padding-left:18px} .note{color:#4a5b73;font-size:11px}
.box{background:#eef4fb;border-radius:8px;padding:10px 12px;margin:12px 0} .meta{color:#4a5b73;font-size:11px}
article{page-break-inside:avoid}
</style></head><body>
<h1>Relatório de acompanhamento do sono</h1>
<div class="meta">Período: ${esc(input.periodLabel)} · gerado em ${esc(formatDate(input.generatedAt))} ${esc(formatClock(input.generatedAt))}</div>
<div class="box"><strong>Este documento não é laudo médico.</strong> Reúne gravações e informações registradas pelo próprio usuário no RESPIRA Sono. ${esc(REPORT_DISCLAIMER)}</div>
${nightsHtml}
<h2>Origem das medidas e limitações</h2>
<ul>
<li>Áudio captado pelo microfone do telefone, na posição escolhida pelo usuário. Aparelhos e posições diferentes não são diretamente comparáveis.</li>
<li>Cobertura = tempo com áudio salvo ÷ duração da sessão. Lacunas (interrupções do sistema, encerramento do app) não são tratadas como silêncio.</li>
<li>Atividade sonora: segundos acima do ruído de fundo da própria noite (${esc(SIGNAL_ANALYZER.id)}@${esc(SIGNAL_ANALYZER.version)}). Não distingue ronco de outros sons nem identifica quem produziu o som.</li>
<li>${esc(SNORE_ANALYSIS_UNAVAILABLE)} Nenhum índice de apneia (IAH), saturação, estágio de sono ou probabilidade clínica é calculado.</li>
<li>Sintomas e hábitos são autorrelatados.</li>
</ul>
<p class="meta">Versões: app ${esc(v?.app ?? '—')} · análise de sinal ${esc(v?.signalAnalyzer ?? '—')} · regras de orientação ${esc(v?.guidanceRules ?? '—')} (${esc(v?.guidanceReview ?? '—')}).</p>
</body></html>`;
}
