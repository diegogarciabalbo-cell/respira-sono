import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { adherenceDays, completionsSince } from '../../db/exercises';
import { visibleExercises } from '../../content/catalog';
import { DRAFT_PROGRAM } from '../../content/demoExercises';
import { Button } from '../../ui/components';
import { useApp } from '../../state/AppContext';
import { Badge, Card, DemoBanner, H1, H2, P, Screen, Small } from '../../ui/components';

export default function Exercicios() {
  const { db, prefs, flags, dataVersion, profile } = useApp();
  const router = useRouter();
  const [adh, setAdh] = useState<{ done: number; of: number } | null>(null);
  const [lastDiscomfort, setLastDiscomfort] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      (async () => {
        const c = await completionsSince(db, Date.now() - 28 * 86400_000);
        setAdh(adherenceDays(c, 28, Date.now()));
        setLastDiscomfort(c.find((x) => x.discomfort != null)?.discomfort ?? null);
      })();
    }, [db, dataVersion]),
  );

  const items = visibleExercises([], { demoMode: prefs.demoMode, flags });
  const approved = items.filter((i) => i.mode === 'approved');

  return (
    <Screen>
      <H1>Exercícios</H1>
      <P muted>
        Exercícios orofaríngeos podem ajudar algumas pessoas, mas a evidência ainda tem limitações e os resultados variam. O programa deve ser definido e
        acompanhado por fonoaudiólogo com atuação em sono.
      </P>

      {approved.length === 0 ? (
        <Card tone="warn">
          <H2>Programa ainda não disponível</H2>
          <P>Ainda não há exercícios revisados e publicados por um profissional. Quando houver, eles aparecerão aqui com dose, cuidados e o nome do revisor.</P>
        </Card>
      ) : null}

      {profile?.apnea_diagnosis === 'yes' || (profile?.prescribed_treatment && profile.prescribed_treatment !== 'none') ? (
        <Card tone="warn">
          <P>Você informou diagnóstico de apneia ou tratamento prescrito. Converse com seu médico antes de fazer exercícios. Eles não substituem CPAP, aparelho ou outro tratamento indicado.</P>
        </Card>
      ) : null}

      {adh ? <Small>Dias com prática nas últimas 4 semanas: {adh.done} de {adh.of}</Small> : null}
      {lastDiscomfort != null && lastDiscomfort >= 5 ? (
        <Card tone="warn">
          <P>Você registrou desconforto {lastDiscomfort}/10 recentemente. Interrompa os exercícios que causam desconforto e converse com o profissional que acompanha você.</P>
        </Card>
      ) : null}

      {items.some((i) => i.mode === 'demo') ? (
        <>
          <DemoBanner text="Os exercícios abaixo são rascunhos baseados em um estudo publicado (Ieto et al., 2015). Ainda NÃO foram revisados por fonoaudiólogo e não são tratamento aprovado. Antes de começar, converse com um profissional, principalmente se você tem diagnóstico de apneia." />
          <Card tone="demo">
            <H2>{DRAFT_PROGRAM.name}</H2>
            <Small>{DRAFT_PROGRAM.researchProtocol?.description}</Small>
            <Small>Os resultados do estudo não comprovam a eficácia deste aplicativo.</Small>
            <Button
              title="Começar sessão guiada (6 exercícios)"
              onPress={() => {
                const ids = items.filter((i) => i.mode === 'demo').map((i) => i.item.id);
                router.push({ pathname: '/exercicio/[id]', params: { id: ids[0], seq: ids.slice(1).join(',') } });
              }}
            />
          </Card>
        </>
      ) : null}

      {items.map(({ item, mode }) => (
        <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/exercicio/[id]', params: { id: item.id } })}>
          <Card tone={mode === 'demo' ? 'demo' : 'default'}>
            {mode === 'demo' ? <Badge text="RASCUNHO · NÃO REVISADO" tone="demo" /> : <Badge text={`Revisado por ${item.reviewer?.name}`} tone="accent" />}
            <H2>{item.name}</H2>
            <Small>{item.objective}</Small>
          </Card>
        </Pressable>
      ))}

      {!prefs.demoMode && items.length === 0 ? <Small>Modo de demonstração desligado (Perfil → Demonstração).</Small> : null}
      <Small>Programa de várias semanas: a duração e a dose dependem do protocolo revisado. Não prometemos resultados em prazos curtos.</Small>
    </Screen>
  );
}
