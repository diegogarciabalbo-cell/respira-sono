import React, { useState } from 'react';
import { DEMO_EXERCISES } from '../content/demoExercises';
import { ContentStatus, ExerciseContent, publishBlockers, reviewBlockers, transition, TransitionError } from '../domain/content';
import { Badge, Button, Card, DemoBanner, H1, H2, P, Screen, Small } from '../ui/components';

const LABEL: Record<ContentStatus, string> = { draft: 'Rascunho', in_review: 'Em revisão', published: 'Publicado', retired: 'Retirado' };

/**
 * Visualização do fluxo editorial no aparelho (somente leitura/simulação local).
 * A edição e a publicação reais acontecem no servidor, onde as mesmas regras são aplicadas
 * por gatilhos e permissões (ver supabase/migrations). Nenhuma alteração aqui é salva.
 */
export default function Conteudo() {
  const [items, setItems] = useState<ExerciseContent[]>(DEMO_EXERCISES);
  const [msg, setMsg] = useState<Record<string, string[]>>({});

  function attempt(ex: ExerciseContent, to: ContentStatus) {
    try {
      const next = transition(ex, to, 'simulação local', new Date());
      setItems((xs) => xs.map((x) => (x.id === ex.id ? next : x)));
      setMsg((m) => ({ ...m, [ex.id]: [`Movido para ${LABEL[to]} (somente nesta tela, não salvo).`] }));
    } catch (e) {
      const err = e as TransitionError;
      setMsg((m) => ({ ...m, [ex.id]: [err.message, ...(err.blockers ?? [])] }));
    }
  }

  return (
    <Screen>
      <H1>Gerenciar conteúdo</H1>
      <DemoBanner text="Simulação do fluxo editorial. Publicar exige revisor real com credencial verificada, dose definida pelo revisor e referências. Conteúdo de demonstração nunca é publicado." />
      <P muted>Fluxo: rascunho → revisão → publicação → retirada. Mudança material em conteúdo publicado cria nova versão que volta para revisão.</P>
      {items.map((ex) => (
        <Card key={ex.id}>
          <Badge text={`${LABEL[ex.status]} · v${ex.version}`} tone={ex.status === 'published' ? 'accent' : 'demo'} />
          <H2>{ex.name}</H2>
          <Small>Pendências para revisão: {reviewBlockers(ex).length ? reviewBlockers(ex).join('; ') : 'nenhuma'}</Small>
          <Small>Pendências para publicação: {publishBlockers(ex).join('; ') || 'nenhuma'}</Small>
          <Button title="Enviar para revisão" kind="secondary" onPress={() => attempt(ex, 'in_review')} />
          <Button title="Publicar" kind="ghost" onPress={() => attempt(ex, 'published')} />
          {(msg[ex.id] ?? []).map((m, i) => <Small key={i}>{m}</Small>)}
        </Card>
      ))}
    </Screen>
  );
}
