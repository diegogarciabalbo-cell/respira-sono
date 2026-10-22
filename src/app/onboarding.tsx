import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { recordConsent, saveProfile } from '../db/profile';
import { ReportedSymptoms } from '../domain/guidance';
import { useApp } from '../state/AppContext';
import { Button, Card, Choice, Field, H1, H2, P, Scale, Screen, Small, Toggle } from '../ui/components';

type YN = 'sim' | 'nao' | 'nao_sei';
const yn = [
  { value: 'sim' as YN, label: 'Sim' },
  { value: 'nao' as YN, label: 'Não' },
  { value: 'nao_sei' as YN, label: 'Não sei' },
];
const toBool = (v: YN | null) => (v === 'sim' ? true : v === 'nao' ? false : null);

export default function Onboarding() {
  const { db, reloadProfile, reloadConsents } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [age, setAge] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [prior, setPrior] = useState<string | null>(null);
  const [dx, setDx] = useState<'yes' | 'no' | 'unknown' | null>(null);
  const [tx, setTx] = useState<'none' | 'cpap' | 'oral_appliance' | 'other' | null>(null);
  const [pauses, setPauses] = useState<YN | null>(null);
  const [choking, setChoking] = useState<YN | null>(null);
  const [sleepy, setSleepy] = useState<number | null>(null);
  const [driving, setDriving] = useState<YN | null>(null);
  const [partner, setPartner] = useState('');
  const [terms, setTerms] = useState(false);
  const [roomNotice, setRoomNotice] = useState(false);
  const [saving, setSaving] = useState(false);

  const under18 = age === 'under18';

  async function finish() {
    if (!db) return;
    setSaving(true);
    const symptoms: ReportedSymptoms = {
      observedPauses: toBool(pauses),
      recurrentChoking: toBool(choking),
      daytimeSleepiness: (sleepy as ReportedSymptoms['daytimeSleepiness']) ?? null,
      drowsyDriving: toBool(driving),
      diagnosedApnea: dx,
      prescribedTreatment: tx,
    };
    await recordConsent(db, 'terms', true);
    await recordConsent(db, 'room_others_notice', true);
    await saveProfile(db, {
      age_range: age, goal, prior_snoring: prior, apnea_diagnosis: dx, prescribed_treatment: tx, symptoms,
      partner_report: partner.trim() || null, onboarding_completed_at: Date.now(),
    });
    await reloadProfile();
    await reloadConsents();
    setSaving(false);
    router.replace('/');
  }

  return (
    <Screen>
      <View style={{ height: 40 }} />
      <Small>Passo {step + 1} de 4</Small>

      {step === 0 && (
        <>
          <H1>Bem-vindo ao RESPIRA Sono</H1>
          <P muted>Algumas perguntas rápidas para adaptar o app. Você pode pular o que não quiser responder.</P>
          <Choice
            label="Sua faixa etária"
            value={age}
            onChange={setAge}
            options={[
              { value: 'under18', label: 'Menos de 18' },
              { value: '18-29', label: '18–29' },
              { value: '30-44', label: '30–44' },
              { value: '45-59', label: '45–59' },
              { value: '60+', label: '60 ou mais' },
            ]}
          />
          {under18 ? (
            <Card tone="warn">
              <P>Nesta versão, o RESPIRA Sono é destinado a adultos (18 anos ou mais). Se uma criança ou adolescente ronca, converse com o pediatra.</P>
            </Card>
          ) : null}
          <Choice
            label="O que você quer agora?"
            value={goal}
            onChange={setGoal}
            options={[
              { value: 'entender', label: 'Entender meu ronco' },
              { value: 'exercicios', label: 'Seguir exercícios orientados' },
              { value: 'consulta', label: 'Organizar informações para uma consulta' },
            ]}
          />
          <Button title="Continuar" disabled={!age || under18} onPress={() => setStep(1)} />
        </>
      )}

      {step === 1 && (
        <>
          <H1>Seu histórico</H1>
          <P muted>Informações que você mesmo relata. Não fazemos diagnóstico.</P>
          <Choice
            label="Há quanto tempo você ronca (ou dizem que ronca)?"
            value={prior}
            onChange={setPrior}
            options={[
              { value: 'nao_sei', label: 'Não sei' },
              { value: 'menos_1a', label: 'Menos de 1 ano' },
              { value: '1_5a', label: '1 a 5 anos' },
              { value: 'mais_5a', label: 'Mais de 5 anos' },
            ]}
          />
          <Choice
            label="Algum médico já diagnosticou apneia do sono?"
            value={dx}
            onChange={setDx}
            options={[{ value: 'yes', label: 'Sim' }, { value: 'no', label: 'Não' }, { value: 'unknown', label: 'Não sei' }]}
          />
          <Choice
            label="Você usa algum tratamento prescrito para o sono?"
            value={tx}
            onChange={setTx}
            options={[
              { value: 'none', label: 'Nenhum' },
              { value: 'cpap', label: 'CPAP' },
              { value: 'oral_appliance', label: 'Aparelho intraoral' },
              { value: 'other', label: 'Outro' },
            ]}
          />
          {tx && tx !== 'none' ? (
            <Card tone="accent">
              <Small>Continue seu tratamento como combinado com seu médico. O app não ajusta nem substitui tratamentos.</Small>
            </Card>
          ) : null}
          <Button title="Continuar" onPress={() => setStep(2)} />
          <Button title="Voltar" kind="ghost" onPress={() => setStep(0)} />
        </>
      )}

      {step === 2 && (
        <>
          <H1>Sintomas</H1>
          <P muted>Opcional. Usamos estas respostas só para sugerir próximos passos, nunca para diagnosticar.</P>
          <Choice label="Alguém já viu você parar de respirar enquanto dorme?" value={pauses} onChange={setPauses} options={yn} />
          <Choice label="Você acorda engasgado ou sem ar com frequência?" value={choking} onChange={setChoking} options={yn} />
          <Scale label="Quanta sonolência você sente durante o dia?" value={sleepy} onChange={setSleepy} low="Nenhuma" high="Muita" />
          <Choice label="Já sentiu sono ao dirigir?" value={driving} onChange={setDriving} options={yn} />
          <Field
            label="Relato de quem divide o quarto (opcional)"
            value={partner}
            onChangeText={setPartner}
            placeholder="Ex.: ronco alto na maior parte da noite"
            multiline
            maxLength={500}
          />
          <Button title="Continuar" onPress={() => setStep(3)} />
          <Button title="Voltar" kind="ghost" onPress={() => setStep(1)} />
        </>
      )}

      {step === 3 && (
        <>
          <H1>O que o app faz — e o que não faz</H1>
          <Card>
            <H2>Faz</H2>
            <P>• Grava o áudio da sua noite no próprio telefone, mesmo com a tela bloqueada.</P>
            <P>• Mostra a qualidade da gravação, lacunas e trechos para você ouvir.</P>
            <P>• Organiza diário, exercícios e um relatório que você escolhe compartilhar.</P>
          </Card>
          <Card tone="warn">
            <H2>Não faz</H2>
            <P>• Não diagnostica apneia nem calcula risco, índice de apneia ou oxigenação.</P>
            <P>• Não monitora a respiração em tempo real nem emite alertas de emergência.</P>
            <P>• Não substitui consulta, exames (como polissonografia) ou tratamentos prescritos.</P>
          </Card>
          <Card>
            <H2>Sua privacidade</H2>
            <P>O áudio fica no seu telefone. Nada vai para a nuvem sem sua autorização específica. Você pode apagar tudo a qualquer momento.</P>
          </Card>
          <Toggle label="Li e entendi o que o app faz e não faz" value={terms} onChange={setTerms} />
          <Toggle
            label="Vou avisar quem dorme no mesmo quarto"
            hint="A gravação pode captar sons e falas de outras pessoas. Elas devem estar cientes e de acordo."
            value={roomNotice}
            onChange={setRoomNotice}
          />
          <Small>O acesso ao microfone será pedido só quando você for gravar.</Small>
          <Button title="Começar" disabled={!terms || !roomNotice} loading={saving} onPress={finish} />
          <Button title="Voltar" kind="ghost" onPress={() => setStep(2)} />
        </>
      )}
    </Screen>
  );
}
