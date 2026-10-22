import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { getDiary } from '../../db/diary';
import { adherenceDays, completionsSince } from '../../db/exercises';
import { listSessions, SessionRow } from '../../db/sessions';
import { formatDate, formatDuration, formatPercent, nightKey } from '../../domain/format';
import { nextSteps } from '../../domain/guidance';
import { useApp } from '../../state/AppContext';
import { Badge, Button, Card, H1, H2, P, Screen, Small } from '../../ui/components';
import { StepCard } from '../../ui/StepCard';
import { useT } from '../../i18n/useT';

export default function Hoje() {
  const { db, profile, recorder, recoveredIds, dismissRecovered, dataVersion } = useApp();
  const router = useRouter();
  const { t, locale } = useT();
  const [last, setLast] = useState<SessionRow | null>(null);
  const [diaryDone, setDiaryDone] = useState(false);
  const [adh, setAdh] = useState<{ done: number; of: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      (async () => {
        const s = await listSessions(db);
        const ended = s.find((x) => x.status !== 'recording') ?? null;
        setLast(ended);
        const key = ended ? nightKey(ended.started_at) : nightKey(Date.now() - 12 * 3600_000);
        setDiaryDone(!!(await getDiary(db, key)));
        const since = Date.now() - 7 * 86400_000;
        setAdh(adherenceDays(await completionsSince(db, since), 7, Date.now()));
      })();
    }, [db, dataVersion]),
  );

  const steps = profile ? nextSteps(profile.symptoms) : [];
  const priority = steps.filter((s) => s.level === 'urgent' || s.level === 'safety' || s.level === 'evaluate');
  const recording = recorder && recorder.state !== 'idle';
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <Screen>
      <H1>{hello}</H1>

      {recordedNotice(recoveredIds.length, () => {
        const id = recoveredIds[0];
        dismissRecovered();
        router.push({ pathname: '/sessao/[id]', params: { id } });
      })}

      {recording ? (
        <Card tone="accent">
          <Badge text="GRAVANDO" tone="accent" />
          <P>Sua noite está sendo gravada.</P>
          <Button title="Ver gravação" onPress={() => router.push('/gravar')} />
        </Card>
      ) : null}

      {priority.map((s) => <StepCard key={s.id} step={s} />)}

      {last ? (
        <Card>
          <H2>Última noite · {formatDate(last.started_at)}</H2>
          <Small>
            {formatDuration(last.captured_ms ?? 0)} de áudio · cobertura {formatPercent(last.coverage)}
            {last.status === 'interrupted' ? ' · interrompida' : last.status === 'failed' ? ' · sem áudio' : ''}
          </Small>
          <Button title="Ver resumo da noite" kind="secondary" onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: last.id } })} />
        </Card>
      ) : !recording ? (
        <Card>
          <H2>Sua primeira noite</H2>
          <P muted>Faça o teste de microfone e grave uma noite. De manhã, você poderá ouvir os trechos e ver a qualidade da gravação.</P>
          <Button title="Preparar gravação" onPress={() => router.push('/gravar')} />
        </Card>
      ) : null}

      <Card>
        <H2>Diário</H2>
        <P muted>{diaryDone ? 'Diário da última noite preenchido.' : 'Leva menos de um minuto: horários, descanso e fatores da noite.'}</P>
        <Button title={diaryDone ? 'Editar diário' : 'Preencher diário'} kind="secondary" onPress={() => router.push('/diario')} />
      </Card>

      {adh ? (
        <Card>
          <H2>Exercícios</H2>
          <P muted>Dias com prática nos últimos 7 dias: {adh.done} de {adh.of}</P>
          <Button title="Ir para exercícios" kind="secondary" onPress={() => router.push('/exercicios')} />
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="Biblioteca" kind="ghost" onPress={() => router.push('/biblioteca')} /></View>
        <View style={{ flex: 1 }}><Button title="Relatório" kind="ghost" onPress={() => router.push('/relatorio')} /></View>
      </View>
      {locale !== 'pt-BR' ? <Small>{t('language.partialNotice')}</Small> : null}
      <Small>{t('safety.footer', { emergency: t('safety.emergencyNumber') })}</Small>
      <Small>{t('safety.notMedicalDevice')}</Small>
    </Screen>
  );
}

function recordedNotice(n: number, open: () => void) {
  if (!n) return null;
  return (
    <Card tone="warn">
      <H2>Gravação interrompida</H2>
      <P>
        {n === 1 ? 'Uma gravação' : `${n} gravações`} não foi encerrada normalmente (o app ou o sistema a interrompeu). Recuperamos os trechos salvos; o
        período posterior não foi gravado.
      </P>
      <Button title="Ver o que foi salvo" kind="secondary" onPress={open} />
    </Card>
  );
}
