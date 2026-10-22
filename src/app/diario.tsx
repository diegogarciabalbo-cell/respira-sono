import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getDiary, upsertDiary } from '../db/diary';
import { nightKey } from '../domain/format';
import { nextSteps } from '../domain/guidance';
import { useApp } from '../state/AppContext';
import { Button, Card, Choice, Field, H1, H2, P, Scale, Screen, Small } from '../ui/components';
import { StepCard } from '../ui/StepCard';

type Tri = 'sim' | 'nao' | '';
const tri = [{ value: 'sim' as Tri, label: 'Sim' }, { value: 'nao' as Tri, label: 'Não' }];
const toInt = (v: Tri) => (v === 'sim' ? 1 : v === 'nao' ? 0 : null);
const fromInt = (v: number | null | undefined): Tri => (v === 1 ? 'sim' : v === 0 ? 'nao' : '');

export default function Diario() {
  const params = useLocalSearchParams<{ night?: string }>();
  const night = params.night ?? nightKey(Date.now() - 12 * 3600_000);
  const { db, profile, bump } = useApp();
  const router = useRouter();
  const [bed, setBed] = useState('');
  const [wake, setWake] = useState('');
  const [rested, setRested] = useState<number | null>(null);
  const [sleepiness, setSleepiness] = useState<number | null>(null);
  const [exercises, setExercises] = useState<Tri>('');
  const [alcohol, setAlcohol] = useState<Tri>('');
  const [nasal, setNasal] = useState<Tri>('');
  const [treatment, setTreatment] = useState<Tri>('');
  const [partner, setPartner] = useState('');
  const [pauses, setPauses] = useState<Tri>('');
  const [choking, setChoking] = useState<Tri>('');
  const [driving, setDriving] = useState<Tri>('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!db) return;
    getDiary(db, night).then((e) => {
      if (!e) return;
      setBed(e.bed_time ?? ''); setWake(e.wake_time ?? ''); setRested(e.rested); setSleepiness(e.sleepiness);
      setExercises(fromInt(e.exercises_done)); setAlcohol(fromInt(e.alcohol)); setNasal(fromInt(e.nasal_congestion));
      setTreatment(fromInt(e.prescribed_treatment_used)); setPartner(e.partner_report ?? '');
      setPauses(fromInt(e.observed_pauses)); setChoking(fromInt(e.recurrent_choking)); setDriving(fromInt(e.drowsy_driving));
    });
  }, [db, night]);

  async function save() {
    if (!db) return;
    try {
      await upsertDiary(db, night, {
        bed_time: bed || null, wake_time: wake || null, rested, sleepiness, exercises_done: toInt(exercises), alcohol: toInt(alcohol),
        nasal_congestion: toInt(nasal), prescribed_treatment_used: toInt(treatment), partner_report: partner.trim() || null,
        observed_pauses: toInt(pauses), recurrent_choking: toInt(choking), drowsy_driving: toInt(driving),
      });
      bump();
      setSaved(true);
    } catch (e: any) {
      Alert.alert('Confira os campos', e.message);
    }
  }

  const hasTreatment = profile?.prescribed_treatment && profile.prescribed_treatment !== 'none';
  const steps = saved
    ? nextSteps({
        ...(profile?.symptoms ?? {}),
        observedPauses: pauses === 'sim' || profile?.symptoms.observedPauses,
        recurrentChoking: choking === 'sim' || profile?.symptoms.recurrentChoking,
        drowsyDriving: driving === 'sim' || profile?.symptoms.drowsyDriving,
      }).filter((s) => s.level !== 'info')
    : [];

  return (
    <Screen>
      <H1>Diário da noite</H1>
      <Small>Noite de {night.split('-').reverse().join('/')} · tudo é opcional e informado por você.</Small>
      <Field label="Hora em que deitou (HH:MM)" value={bed} onChangeText={setBed} placeholder="23:00" />
      <Field label="Hora em que levantou (HH:MM)" value={wake} onChangeText={setWake} placeholder="07:00" />
      <Scale label="Quão descansado você acordou?" value={rested} onChange={setRested} low="Nada" high="Muito" />
      <Scale label="Sonolência durante o dia" value={sleepiness} onChange={setSleepiness} low="Nenhuma" high="Muita" />
      <Choice label="Fez os exercícios ontem?" value={exercises} onChange={setExercises} options={tri} />
      <Choice label="Bebeu álcool à noite?" value={alcohol} onChange={setAlcohol} options={tri} />
      <Choice label="Nariz entupido?" value={nasal} onChange={setNasal} options={tri} />
      {hasTreatment ? (
        <>
          <Choice label="Usou o tratamento prescrito?" value={treatment} onChange={setTreatment} options={tri} />
          <Small>Apenas registro. Mudanças no tratamento devem ser combinadas com seu médico.</Small>
        </>
      ) : null}
      <Card>
        <H2>Relato de quem divide o quarto</H2>
        <Small>Fica separado das medidas da gravação.</Small>
        <Field label="O que a pessoa percebeu?" value={partner} onChangeText={setPartner} multiline maxLength={500} />
        <Choice label="Viu pausas na respiração?" value={pauses} onChange={setPauses} options={tri} />
      </Card>
      <Choice label="Acordou engasgado ou sem ar?" value={choking} onChange={setChoking} options={tri} />
      <Choice label="Sentiu sono ao dirigir hoje?" value={driving} onChange={setDriving} options={tri} />
      <Button title="Salvar" onPress={save} />
      {saved ? (
        <>
          <Card tone="accent"><P>Diário salvo.</P></Card>
          {steps.map((s) => <StepCard key={s.id} step={s} />)}
          <Button title="Concluir" kind="ghost" onPress={() => router.back()} />
        </>
      ) : null}
    </Screen>
  );
}
