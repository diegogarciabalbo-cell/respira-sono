import Constants from 'expo-constants';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { getDiary } from '../db/diary';
import { audit, getSession, listSessions } from '../db/sessions';
import { Coverage } from '../domain/coverage';
import { formatDate, nightKey } from '../domain/format';
import { nextSteps } from '../domain/guidance';
import { buildNightSummary, buildReportHtml } from '../domain/report';
import { useApp } from '../state/AppContext';
import { Button, Card, Choice, H1, P, Screen, Small, Toggle } from '../ui/components';

export default function Relatorio() {
  const { db, profile } = useApp();
  const [days, setDays] = useState<'7' | '14' | '30'>('14');
  const [sec, setSec] = useState({ recording: true, acoustic: true, reported: true, next: true });
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!db) return;
    setBusy(true);
    try {
      const since = Date.now() - Number(days) * 86400_000;
      const sessions = (await listSessions(db)).filter((s) => s.started_at >= since && s.status !== 'recording' && !s.is_demo).reverse();
      if (!sessions.length) {
        Alert.alert('Sem noites no período', 'Grave pelo menos uma noite para gerar o relatório.');
        return;
      }
      const nights = [];
      for (const s of sessions) {
        const full = await getSession(db, s.id);
        if (!full) continue;
        const d = await getDiary(db, nightKey(s.started_at));
        const coverage: Coverage = {
          windowStart: s.started_at, windowEnd: s.ended_at ?? s.started_at, wallMs: s.wall_ms ?? 0, capturedMs: s.captured_ms ?? 0,
          gapMs: s.gap_ms ?? 0, coverage: s.coverage ?? 0,
          gaps: full.gaps.map((g) => ({ startAt: g.start_at, endAt: g.end_at, durationMs: g.duration_ms, reason: g.reason })),
        };
        nights.push(buildNightSummary({
          sessionId: s.id, startedAt: s.started_at, endedAt: s.ended_at ?? s.started_at, status: s.status, stopReason: s.stop_reason,
          device: s.device, sampleRate: s.sample_rate, bitRate: s.bit_rate, codec: s.codec, batteryStart: s.battery_start, batteryEnd: s.battery_end,
          lostSegments: s.lost_segments, coverage, signal: full.signal, snoreAnalysis: { status: 'unavailable' },
          diary: d ? {
            bedTime: d.bed_time, wakeTime: d.wake_time, rested: d.rested, sleepiness: d.sleepiness, alcohol: d.alcohol == null ? null : !!d.alcohol,
            nasalCongestion: d.nasal_congestion == null ? null : !!d.nasal_congestion, exercisesDone: d.exercises_done == null ? null : !!d.exercises_done,
            prescribedTreatmentUsed: d.prescribed_treatment_used == null ? null : !!d.prescribed_treatment_used, partnerReport: d.partner_report,
          } : null,
          steps: nextSteps(profile?.symptoms ?? {}),
          appVersion: Constants.expoConfig?.version ?? '0.0.0',
        }));
      }
      const html = buildReportHtml({
        periodLabel: `${formatDate(sessions[0].started_at)} a ${formatDate(sessions[sessions.length - 1].started_at)} (${sessions.length} noites)`,
        generatedAt: Date.now(),
        nights,
        includeSections: sec,
      });
      const { uri } = await Print.printToFileAsync({ html });
      await audit(db, 'report_exported', null);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar relatório', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('PDF gerado', 'O compartilhamento não está disponível neste aparelho.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>Relatório compartilhável</H1>
      <P muted>Gera um PDF para você levar a uma consulta ou enviar a quem quiser. Nada é enviado automaticamente.</P>
      <Choice label="Período" value={days} onChange={setDays} options={[{ value: '7', label: '7 dias' }, { value: '14', label: '14 dias' }, { value: '30', label: '30 dias' }]} />
      <Card>
        <Toggle label="Qualidade e duração da gravação" value={sec.recording} onChange={(v) => setSec({ ...sec, recording: v })} />
        <Toggle label="Achados acústicos" value={sec.acoustic} onChange={(v) => setSec({ ...sec, acoustic: v })} />
        <Toggle label="Sintomas e hábitos informados" value={sec.reported} onChange={(v) => setSec({ ...sec, reported: v })} />
        <Toggle label="Próximos passos" value={sec.next} onChange={(v) => setSec({ ...sec, next: v })} />
      </Card>
      <Small>O relatório não é laudo médico. Inclui cobertura, limitações, origem das medidas e versões. Não inclui áudio.</Small>
      <Button title="Gerar PDF e compartilhar" loading={busy} onPress={generate} />
    </Screen>
  );
}
