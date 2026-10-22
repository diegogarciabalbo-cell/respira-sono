import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { listDiary } from '../../db/diary';
import { getSession, listSessions, SessionRow } from '../../db/sessions';
import { formatDate, formatDuration, formatPercent, nightKey } from '../../domain/format';
import { compareFactor, NightObservation } from '../../domain/insights';
import { useApp } from '../../state/AppContext';
import { Badge, Card, H1, H2, P, Screen, Small } from '../../ui/components';
import { useTheme } from '../../ui/theme';

const STATUS: Record<SessionRow['status'], { text: string; tone: 'accent' | 'warn' | 'danger' | 'default' }> = {
  completed: { text: 'Concluída', tone: 'accent' },
  interrupted: { text: 'Interrompida', tone: 'warn' },
  failed: { text: 'Sem áudio', tone: 'danger' },
  recording: { text: 'Gravando', tone: 'accent' },
};

export default function Historico() {
  const { db, dataVersion } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [activity, setActivity] = useState<Record<string, number | null>>({});
  const [insights, setInsights] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      (async () => {
        const s = await listSessions(db);
        setRows(s);
        const act: Record<string, number | null> = {};
        for (const r of s.slice(0, 30)) act[r.id] = (await getSession(db, r.id))?.signal?.activeRatio ?? null;
        setActivity(act);
        const diary = await listDiary(db, 90);
        const obs: NightObservation[] = diary.map((d) => {
          const sess = s.find((x) => nightKey(x.started_at) === d.night);
          return {
            date: d.night,
            factors: { alcohol: d.alcohol == null ? null : !!d.alcohol, nasal: d.nasal_congestion == null ? null : !!d.nasal_congestion },
            outcome: d.rested,
            conditionKey: sess ? `${sess.device ?? '?'}|${sess.phone_position ?? '?'}` : null,
          };
        });
        setInsights([
          compareFactor(obs, 'alcohol', { factor: 'álcool', outcome: 'o descanso percebido' }).statement,
          compareFactor(obs, 'nasal', { factor: 'congestão nasal', outcome: 'o descanso percebido' }).statement,
        ]);
      })();
    }, [db, dataVersion]),
  );

  const comparable = rows.filter((r) => r.status === 'completed' || r.status === 'interrupted').slice(0, 14).reverse();

  return (
    <Screen>
      <H1>Histórico</H1>
      {rows.length === 0 ? <P muted>Nenhuma noite gravada ainda.</P> : null}

      {comparable.length >= 2 ? (
        <Card>
          <H2>Cobertura das últimas noites</H2>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4 }} accessibilityLabel="Gráfico de cobertura por noite">
            {comparable.map((r) => (
              <View key={r.id} style={{ flex: 1, height: Math.max(3, (r.coverage ?? 0) * 76), backgroundColor: t.accent, borderRadius: 3 }} />
            ))}
          </View>
          <Small>Cada barra é uma noite (mais antiga à esquerda). Aparelhos ou posições diferentes não são diretamente comparáveis.</Small>
        </Card>
      ) : null}

      {rows.map((r) => (
        <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: r.id } })}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <H2>{formatDate(r.started_at)}</H2>
              <Badge text={STATUS[r.status].text} tone={STATUS[r.status].tone} />
            </View>
            <Small>
              {formatDuration(r.captured_ms ?? 0)} gravados · cobertura {formatPercent(r.coverage)}
              {activity[r.id] != null ? ` · atividade sonora ${formatPercent(activity[r.id])}` : ''}
            </Small>
            {r.audio_deleted_at ? <Small>Áudio apagado pela retenção; resumo mantido.</Small> : null}
            {r.is_demo ? <Badge text="DEMONSTRAÇÃO" tone="demo" /> : null}
          </Card>
        </Pressable>
      ))}

      {insights.length ? (
        <Card>
          <H2>Observações do diário</H2>
          {insights.map((s, i) => <P key={i} muted>{s}</P>)}
        </Card>
      ) : null}
    </Screen>
  );
}
