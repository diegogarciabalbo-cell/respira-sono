import React from 'react';
import { GUIDANCE_RULES } from '../domain/guidance';
import { SIGNAL_ANALYZER } from '../domain/signal';
import { useApp } from '../state/AppContext';
import { Card, H1, H2, P, Screen, Small } from '../ui/components';
import { APP_ENV } from '../services/remote';

export default function Sobre() {
  const { flags } = useApp();
  return (
    <Screen>
      <H1>Sobre e limites</H1>
      <Card>
        <H2>Finalidade desta versão</H2>
        <P>Registrar o áudio da noite, mostrar a qualidade da gravação e a atividade sonora, organizar diário e exercícios e gerar um relatório para você levar a um profissional.</P>
      </Card>
      <Card tone="warn">
        <H2>O que o app não faz</H2>
        <P>Não diagnostica apneia, não calcula índice de apneia (IAH), saturação, estágios do sono ou probabilidade de doença, não monitora emergências e não orienta mudanças em CPAP, medicamentos ou aparelhos.</P>
        <P>Uma gravação comum não confirma nem exclui apneia. Redução do ronco não significa que a apneia foi resolvida.</P>
      </Card>
      <Card>
        <H2>Análise acústica</H2>
        <P>A análise atual mede qualidade do sinal e atividade sonora acima do ruído de fundo. Ela não identifica ronco e não sabe quem produziu o som.</P>
        <P>Análise automática de ronco ainda indisponível.</P>
        <Small>{SIGNAL_ANALYZER.id}@{SIGNAL_ANALYZER.version}: {SIGNAL_ANALYZER.description}</Small>
      </Card>
      <Card>
        <H2>Versões e módulos</H2>
        <Small>Regras de orientação: v{GUIDANCE_RULES.version} ({GUIDANCE_RULES.reviewStatus === 'approved' ? 'revisadas' : 'provisórias, pendentes de revisão clínica'})</Small>
        <Small>Ambiente: {APP_ENV}</Small>
        {Object.entries(flags).map(([k, v]) => <Small key={k}>{k}: {v ? 'ligado' : 'desligado'}</Small>)}
      </Card>
    </Screen>
  );
}
