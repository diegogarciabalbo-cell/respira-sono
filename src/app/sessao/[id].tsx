import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { getDiary } from '../../db/diary';
import { deleteSession, deleteSessionAudio, getSession, GapRow, SegmentRow, SessionRow, setKeep } from '../../db/sessions';
import { computeCoverage } from '../../domain/coverage';
import { formatClock, formatDuration, nightKey } from '../../domain/format';
import { nextSteps, ReportedSymptoms } from '../../domain/guidance';
import { buildNightSummary, DiarySnapshot } from '../../domain/report';
import { SignalSummary } from '../../domain/signal';
import { segmentUri, sessionFiles } from '../../services/files';
import { useApp } from '../../state/AppContext';
import { Badge, Button, Card, H1, H2, P, Screen, Small, Timeline, Toggle } from '../../ui/components';
import { useTheme } from '../../ui/theme';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, profile, bump } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [data, setData] = useState<{ session: SessionRow; segments: SegmentRow[]; gaps: GapRow[]; signal: SignalSummary | null } | null>(null);
  const [diary, setDiary] = useState<DiarySnapshot | null>(null);
  const [diarySymptoms, setDiarySymptoms] = useState<ReportedSymptoms>({});
  const [current, setCurrent] = useState<{ file: string; offsetS: number } | null>(null);

  const load = useCallback(async () => {
    if (!db || !id) return;
    const d = await getSession(db, id);
    setData(d);
    if (d) {
      const e = await getDiary(db, nightKey(d.session.started_at));
      setDiarySymptoms({
        observedPauses: e?.observed_pauses ? true : null,
        recurrentChoking: e?.recurrent_choking ? true : null,
        drowsyDriving: e?.drowsy_driving ? true : null,
        daytimeSleepiness: (e?.sleepiness as ReportedSymptoms['daytimeSleepiness']) ?? null,
      });
      setDiary(
        e
          ? {
              bedTime: e.bed_time, wakeTime: e.wake_time, rested: e.rested, sleepiness: e.sleepiness, alcohol: e.alcohol == null ? null : !!e.alcohol,
              nasalCongestion: e.nasal_congestion == null ? null : !!e.nasal_congestion, exercisesDone: e.exercises_done == null ? null : !!e.exercises_done,
              prescribedTreatmentUsed: e.prescribed_treatment_used == null ? null : !!e.prescribed_treatment_used, partnerReport: e.partner_report,
            }
          : null,
      );
    }
  }, [db, id]);

  useEffect(() => { load(); }, [load]);

  const playable = useMemo(() => (data?.segments ?? []).filter((s) => s.status === 'complete' || s.status === 'recovered'), [data]);
  const player = useAudioPlayer(current && data?.session.dir ? { uri: segmentUri(data.session.dir, current.file) } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (current && status.isLoaded && current.offsetS > 0 && status.currentTime < 0.5) {
      player.seekTo(current.offsetS).then(() => player.play());
    }
  }, [current, status.isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Screen><P muted>Carregando…</P></Screen>;
  const { session: s, segments, gaps, signal } = data;

  if (s.status === 'recording') {
    return (
      <Screen>
        <H1>Gravação em andamento</H1>
        <Button title="Ver gravação" onPress={() => router.replace('/gravar')} />
      </Screen>
    );
  }

  // Sintomas do perfil + do diário desta noite. Nenhum dado acústico entra nas regras.
  const symptoms = mergeSymptoms(profile?.symptoms ?? {}, diarySymptoms);
  const steps = nextSteps(symptoms);
  const coverage = computeCoverage({
    windowStart: s.started_at,
    windowEnd: s.ended_at ?? s.started_at,
    segments: segments.map((x) => ({ startAt: x.start_at, durationMs: x.duration_ms, status: x.status })),
  });
  coverage.gaps = gaps.map((g) => ({ startAt: g.start_at, endAt: g.end_at, durationMs: g.duration_ms, reason: g.reason }));
  const summary = buildNightSummary({
    sessionId: s.id,
    startedAt: s.started_at,
    endedAt: s.ended_at ?? s.started_at,
    status: s.status,
    stopReason: s.stop_reason,
    device: s.device,
    sampleRate: s.sample_rate,
    bitRate: s.bit_rate,
    codec: s.codec,
    batteryStart: s.battery_start,
    batteryEnd: s.battery_end,
    lostSegments: s.lost_segments,
    coverage,
    signal,
    snoreAnalysis: { status: 'unavailable' },
    diary,
    steps,
    appVersion: Constants.expoConfig?.version ?? '0.0.0',
  });

  function playAt(at: number) {
    const seg = playable.find((x) => at >= x.start_at && at < x.start_at + x.duration_ms) ?? playable.find((x) => x.start_at >= at);
    if (!seg) return;
    setCurrent({ file: seg.file, offsetS: Math.max(0, (at - seg.start_at) / 1000) });
  }

  function confirmDelete() {
    Alert.alert('Apagar esta noite?', 'O áudio e o resumo serão apagados deste aparelho. Não é possível desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar', style: 'destructive',
        onPress: async () => {
          if (!db) return;
          await deleteSession(db, sessionFiles, s.id);
          bump();
          router.back();
        },
      },
    ]);
  }

  function confirmDeleteAudio() {
    Alert.alert('Apagar só o áudio?', 'O resumo continua no histórico, mas não será possível ouvir os trechos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar áudio', style: 'destructive', onPress: async () => { if (db) { await deleteSessionAudio(db, sessionFiles, s.id); bump(); load(); } } },
    ]);
  }

  return (
    <Screen>
      <H1>{summary.title}</H1>
      <P muted>{summary.intro}</P>

      {summary.blocks.map((b) => (
        <Card key={b.key} tone={b.key === 'next' && steps.some((x) => x.level !== 'info') ? 'warn' : 'default'}>
          <H2>{b.title}</H2>
          {b.lines.map((l, i) => <P key={i}>{l}</P>)}
          {b.notes.map((n, i) => <Small key={i}>{n}</Small>)}
          {b.key === 'acoustic' && signal?.timeline.length ? <Timeline points={signal.timeline} /> : null}
        </Card>
      ))}

      {!s.audio_deleted_at && playable.length ? (
        <Card>
          <H2>Ouvir</H2>
          {current ? (
            <View style={{ gap: 6 }}>
              <Small>Tocando trecho de {formatClock(playable.find((x) => x.file === current.file)?.start_at ?? s.started_at)}</Small>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Button title={status.playing ? 'Pausar' : 'Tocar'} kind="secondary" onPress={() => (status.playing ? player.pause() : player.play())} /></View>
                <View style={{ flex: 1 }}><Button title="−15 s" kind="ghost" onPress={() => player.seekTo(Math.max(0, status.currentTime - 15))} /></View>
                <View style={{ flex: 1 }}><Button title="+15 s" kind="ghost" onPress={() => player.seekTo(status.currentTime + 15)} /></View>
              </View>
            </View>
          ) : null}
          {signal?.highlights.length ? (
            <>
              <Small>Trechos com mais atividade sonora (podem ser ronco, fala, ambiente ou outra pessoa):</Small>
              {signal.highlights.map((h) => (
                <Button key={h.startAt} title={`Ouvir ${formatClock(h.startAt)}`} kind="ghost" onPress={() => playAt(h.startAt)} />
              ))}
            </>
          ) : null}
          <Small>Todos os trechos gravados:</Small>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {playable.map((seg) => (
              <Pressable
                key={seg.id}
                accessibilityRole="button"
                accessibilityLabel={`Trecho das ${formatClock(seg.start_at)}, ${formatDuration(seg.duration_ms)}`}
                onPress={() => setCurrent({ file: seg.file, offsetS: 0 })}
                style={{ paddingHorizontal: 10, minHeight: 40, justifyContent: 'center', borderRadius: 10, backgroundColor: current?.file === seg.file ? t.primary : t.surfaceAlt }}
              >
                <Small color={current?.file === seg.file ? t.primaryText : t.text}>
                  {formatClock(seg.start_at)}{seg.status === 'recovered' ? ' (recuperado)' : ''}
                </Small>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : s.audio_deleted_at ? (
        <Card><P muted>O áudio desta noite foi apagado. O resumo foi mantido.</P></Card>
      ) : null}

      <Card>
        <Toggle label="Manter o áudio desta noite" hint="Ignora a retenção automática para esta noite." value={!!s.keep} onChange={async (v) => { if (db) { await setKeep(db, s.id, v); load(); } }} />
        {s.is_demo ? <Badge text="DEMONSTRAÇÃO" tone="demo" /> : null}
        <Small>Versões: {summary.versions.signalAnalyzer} · regras {summary.versions.guidanceRules} ({summary.versions.guidanceReview})</Small>
        <Small>{summary.disclaimer}</Small>
      </Card>

      <Button title="Preencher diário desta noite" kind="secondary" onPress={() => router.push({ pathname: '/diario', params: { night: nightKey(s.started_at) } })} />
      {!s.audio_deleted_at ? <Button title="Apagar só o áudio" kind="ghost" onPress={confirmDeleteAudio} /> : null}
      <Button title="Apagar esta noite" kind="danger" onPress={confirmDelete} />
    </Screen>
  );
}

function mergeSymptoms(a: ReportedSymptoms, b: ReportedSymptoms): ReportedSymptoms {
  return {
    ...a,
    observedPauses: a.observedPauses || b.observedPauses || null,
    recurrentChoking: a.recurrentChoking || b.recurrentChoking || null,
    drowsyDriving: a.drowsyDriving || b.drowsyDriving || null,
    daytimeSleepiness: (Math.max(a.daytimeSleepiness ?? 0, b.daytimeSleepiness ?? 0) || null) as ReportedSymptoms['daytimeSleepiness'],
  };
}
