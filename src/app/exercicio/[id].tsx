import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Linking, Pressable, Text, View } from 'react-native';
import { findExercise } from '../../content/catalog';
import { DEMO_TIMER_SECONDS } from '../../content/demoExercises';
import { canOfferAsApproved } from '../../domain/content';
import { recordCompletion } from '../../db/exercises';
import { useApp } from '../../state/AppContext';
import { Badge, Button, Card, DemoBanner, Field, H1, H2, P, Screen, Small } from '../../ui/components';
import { useTheme } from '../../ui/theme';

/**
 * Player de exercício: mídia (quando licenciada), legenda/texto sempre visível, temporizador,
 * contador de repetições, pausar/repetir e registro de conclusão e desconforto.
 * Funciona sem som: todas as instruções estão em texto e anúncios de acessibilidade.
 */
export default function ExercisePlayer() {
  const { id, seq } = useLocalSearchParams<{ id: string; seq?: string }>();
  // Sessão guiada: lista dos próximos exercícios, separados por vírgula.
  const queue = (seq ?? '').split(',').filter(Boolean);
  const { db, flags, bump } = useApp();
  const router = useRouter();
  const t = useTheme();
  const ex = findExercise(id ?? '');
  const approved = ex ? canOfferAsApproved(ex, { clinicalContent: flags.clinical_content }) : false;

  const targetSeconds = approved ? ex?.dose?.durationSeconds ?? ex?.dose?.holdSeconds ?? null : DEMO_TIMER_SECONDS;
  // Sem dose revisada não há meta de repetições: o contador só registra o que foi feito.
  const targetReps = approved ? ex?.dose?.reps ?? null : null;

  const [step, setStep] = useState(0);
  const [remaining, setRemaining] = useState(targetSeconds ?? 0);
  const [running, setRunning] = useState(false);
  const [reps, setReps] = useState(0);
  const [secondsDone, setSecondsDone] = useState(0);
  const [discomfort, setDiscomfort] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [finished, setFinished] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          AccessibilityInfo.announceForAccessibility('Tempo concluído');
          return 0;
        }
        return r - 1;
      });
      setSecondsDone((s) => s + 1);
    }, 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]);

  if (!ex) return <Screen><P>Exercício não encontrado.</P></Screen>;

  async function save(stoppedEarly: boolean) {
    if (!db || !ex) return;
    await recordCompletion(db, {
      exerciseId: ex.id, version: ex.version, contentStatus: ex.isDemo ? 'demo' : ex.status, repsDone: reps, secondsDone,
      stoppedEarly, discomfort, discomfortNote: note.trim() || null,
    });
    bump();
    setFinished(true);
  }

  return (
    <Screen>
      {!approved ? <DemoBanner text="Rascunho baseado em pesquisa publicada, ainda NÃO revisado por fonoaudiólogo. Não é tratamento aprovado. Não substitui avaliação profissional." /> : <Badge text={`Revisado por ${ex.reviewer?.name} (${ex.reviewer?.credential}) · v${ex.version}`} tone="accent" />}
      <H1>{ex.name}</H1>
      <P muted>Objetivo: {ex.objective}</P>
      <Small>Indicado para: {ex.audience}</Small>

      {!approved && ex.researchProtocol ? (
        <Card>
          <H2>Como foi feito no estudo</H2>
          <P>{ex.researchProtocol.description}</P>
          <Small>{ex.researchProtocol.source}</Small>
          {(ex.researchProtocol.discrepancies ?? []).map((d, i) => <Small key={i}>Atenção: {d}</Small>)}
          <Small>Isto é uma referência de pesquisa, não uma prescrição. A quantidade adequada para você deve ser definida por um profissional.</Small>
        </Card>
      ) : null}

      <Card>
        <H2>Mídia</H2>
        {ex.media.kind === 'none' ? (
          <Small>Sem vídeo ou animação. O conteúdo audiovisual deve ser original ou licenciado e é adicionado na revisão.</Small>
        ) : (
          <Small>Mídia: {ex.media.license}</Small>
        )}
      </Card>

      <Card>
        <H2>Instrução {step + 1} de {ex.instructions.length}</H2>
        <Text accessibilityLiveRegion="polite" style={{ color: t.text, fontSize: t.fs(19), lineHeight: t.fs(27) }}>{ex.instructions[step]}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="Anterior" kind="ghost" disabled={step === 0} onPress={() => setStep(step - 1)} /></View>
          <View style={{ flex: 1 }}><Button title="Próxima" kind="secondary" disabled={step >= ex.instructions.length - 1} onPress={() => setStep(step + 1)} /></View>
        </View>
      </Card>

      <Card>
        <H2>Temporizador e repetições</H2>
        {!approved ? <Small>Temporizador de demonstração ({DEMO_TIMER_SECONDS} s). Não é dose.</Small> : null}
        {targetSeconds != null ? (
          <>
            <Text accessibilityLabel={`${remaining} segundos restantes`} style={{ color: t.primary, fontSize: t.fs(48), fontWeight: '800', textAlign: 'center' }}>
              {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button title={running ? 'Pausar' : 'Iniciar'} onPress={() => setRunning(!running)} /></View>
              <View style={{ flex: 1 }}><Button title="Repetir" kind="secondary" onPress={() => { setRunning(false); setRemaining(targetSeconds); }} /></View>
            </View>
          </>
        ) : <Small>Duração ainda não definida pelo revisor.</Small>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Diminuir repetições" onPress={() => setReps(Math.max(0, reps - 1))} style={{ minWidth: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: t.surfaceAlt }}>
            <Text style={{ color: t.text, fontSize: t.fs(24) }}>−</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={{ color: t.text, fontSize: t.fs(22), fontWeight: '700' }}>
            {reps}{targetReps ? ` / ${targetReps}` : ''} repetições
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Contar repetição" onPress={() => setReps(reps + 1)} style={{ minWidth: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: t.primary }}>
            <Text style={{ color: t.primaryText, fontSize: t.fs(24) }}>+</Text>
          </Pressable>
        </View>
      </Card>

      <Card tone="warn">
        <H2>Interrompa se…</H2>
        {ex.stopIf.map((x, i) => <P key={i}>• {x}</P>)}
        {ex.cautions.map((x, i) => <Small key={`c${i}`}>Cuidado: {x}</Small>)}
        {ex.contraindications.map((x, i) => <Small key={`k${i}`}>Contraindicação: {x}</Small>)}
      </Card>

      {!finished ? (
        <Card>
          <H2>Como foi?</H2>
          <Small>Desconforto (0 = nenhum, 10 = muito)</Small>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {Array.from({ length: 11 }, (_, n) => (
              <Pressable key={n} accessibilityRole="radio" accessibilityState={{ selected: discomfort === n }} onPress={() => setDiscomfort(n)}
                style={{ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: discomfort === n ? t.primary : t.surfaceAlt }}>
                <Text style={{ color: discomfort === n ? t.primaryText : t.text, fontWeight: '700' }}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Observação (opcional)" value={note} onChangeText={setNote} multiline maxLength={300} />
          <Button title="Registrar conclusão" onPress={() => save(false)} />
          <Button title="Parei antes do fim" kind="ghost" onPress={() => save(true)} />
        </Card>
      ) : (
        <Card tone={discomfort != null && discomfort >= 5 ? 'warn' : 'accent'}>
          <P>Registrado.</P>
          {discomfort != null && discomfort >= 5 ? (
            <P>Você relatou desconforto importante. Não insista neste exercício e procure o profissional que acompanha você.</P>
          ) : null}
          {queue.length ? (
            <Button
              title={`Próximo exercício (${queue.length} restante${queue.length > 1 ? 's' : ''})`}
              onPress={() => router.replace({ pathname: '/exercicio/[id]', params: { id: queue[0], seq: queue.slice(1).join(',') } })}
            />
          ) : (
            <Button title="Concluir" kind="secondary" onPress={() => router.back()} />
          )}
        </Card>
      )}

      <Card>
        <H2>Referências</H2>
        {ex.references.map((r) => (
          <Pressable key={r.url} accessibilityRole="link" onPress={() => Linking.openURL(r.url)}>
            <Small color={t.primary}>{r.label}</Small>
          </Pressable>
        ))}
        <Small>Versão {ex.version} · status: {ex.isDemo ? 'rascunho de demonstração' : ex.status}</Small>
      </Card>
    </Screen>
  );
}
