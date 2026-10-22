import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { RespiraRecorder } from '../../native/recorder';
import { recordConsent } from '../../db/profile';
import { formatDuration } from '../../domain/format';
import { bytesPerHour, formatBytes, RECORDING_PRESETS } from '../../domain/storage';
import { askMicPermission, preflight, Preflight, startNight, stopNight } from '../../services/recorder';
import { useApp } from '../../state/AppContext';
import { Badge, Button, Card, Choice, H1, H2, P, Screen, Small } from '../../ui/components';
import { useTheme } from '../../ui/theme';

export default function Gravar() {
  const { db, prefs, setPrefs, recorder, bump, reloadConsents } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [pf, setPf] = useState<Preflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const recording = !!recorder && recorder.state !== 'idle';

  const check = useCallback(async () => setPf(await preflight(prefs.preset)), [prefs.preset]);
  useFocusEffect(useCallback(() => { check(); }, [check]));

  // Relógio apenas para a interface. A captura roda no código nativo e não depende disto.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [recording]);

  async function start() {
    if (!db) return;
    setBusy(true);
    try {
      let p = await preflight(prefs.preset);
      const perm = p.blocking.find((b) => b.code === 'permission');
      if (perm && perm.code === 'permission' && perm.canAsk) {
        const ok = await askMicPermission();
        await recordConsent(db, 'microphone', ok);
        await reloadConsents();
        p = await preflight(prefs.preset);
      }
      setPf(p);
      if (p.blocking.length) return;
      await startNight(db, { preset: prefs.preset, phonePosition: prefs.phonePosition });
      bump();
    } catch (e: any) {
      Alert.alert('Não foi possível iniciar', friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmStop() {
    Alert.alert('Encerrar gravação?', 'O áudio salvo até agora ficará disponível no resumo da noite.', [
      { text: 'Continuar gravando', style: 'cancel' },
      { text: 'Encerrar', style: 'destructive', onPress: stop },
    ]);
  }

  async function stop() {
    if (!db || !recorder?.sessionId) return;
    setBusy(true);
    const id = recorder.sessionId;
    try {
      await stopNight(db, id);
      bump();
      router.push({ pathname: '/sessao/[id]', params: { id } });
    } finally {
      setBusy(false);
    }
  }

  if (recording && recorder) {
    const elapsed = now - recorder.startedAtMs;
    const interrupted = recorder.state === 'interrupted';
    return (
      <Screen>
        <H1>Gravando sua noite</H1>
        <Card tone={interrupted ? 'warn' : 'accent'}>
          <Badge text={interrupted ? 'PAUSADA PELO SISTEMA' : 'GRAVANDO'} tone={interrupted ? 'warn' : 'accent'} />
          {interrupted ? (
            <P>O sistema interrompeu o microfone (ex.: ligação ou alarme). A gravação retoma sozinha quando possível; esse período aparecerá como lacuna.</P>
          ) : (
            <P>Pode bloquear a tela e dormir. Deixe o telefone na mesa de cabeceira, com o microfone livre.</P>
          )}
          <View style={{ gap: 4 }}>
            <Small>Desde o início: {formatDuration(elapsed)}</Small>
            <Small>Áudio salvo: {formatDuration(recorder.capturedMs)}</Small>
          </View>
          <LevelBar dbfs={recorder.levelDbfs} active={!interrupted} />
          <Small>Nível relativo do microfone (não é medida calibrada).</Small>
        </Card>
        <Button title="Encerrar gravação" kind="danger" big loading={busy} onPress={confirmStop} />
        <Small>
          Se você fechar o app à força ou o sistema encerrá-lo, a gravação para. Ao reabrir, mostramos o que foi salvo e o período sem áudio.
        </Small>
      </Screen>
    );
  }

  const preset = RECORDING_PRESETS[prefs.preset];
  return (
    <Screen>
      <H1>Gravar noite</H1>
      {!RespiraRecorder ? (
        <Card tone="warn">
          <H2>Gravação indisponível nesta versão</H2>
          <P>A gravação noturna usa um componente nativo. Instale a versão de desenvolvimento do app (veja o guia do projeto). O Expo Go e a web não gravam a noite.</P>
        </Card>
      ) : null}

      <Card>
        <H2>Antes de dormir</H2>
        <P>• Coloque o telefone na mesa de cabeceira, estável, a cerca de um braço de distância da cabeça.</P>
        <P>• Deixe o microfone desobstruído. Não coloque o telefone sob travesseiro, lençol ou cobertor.</P>
        <P>• De preferência, deixe-o carregando.</P>
        <P>• Avise quem dorme no mesmo quarto que a noite será gravada.</P>
      </Card>

      {!prefs.micTested ? (
        <Card tone="warn">
          <P>Recomendamos fazer o teste de microfone antes da primeira noite.</P>
          <Button title="Fazer teste de microfone" kind="secondary" onPress={() => router.push('/teste-microfone')} />
        </Card>
      ) : null}

      <Choice
        label="Onde o telefone vai ficar?"
        value={prefs.phonePosition}
        onChange={(v) => setPrefs({ phonePosition: v })}
        options={[
          { value: 'mesa_cabeceira', label: 'Mesa de cabeceira' },
          { value: 'comoda', label: 'Cômoda / mais longe' },
          { value: 'outro', label: 'Outro lugar estável' },
        ]}
      />
      <Small>Usamos isso só para comparar noites em condições parecidas.</Small>

      {pf?.blocking.map((b) => (
        <Card key={b.code} tone="danger">
          <P>{b.message}</P>
          {b.code === 'storage' ? <Small>Livre: {formatBytes(b.freeBytes)} · necessário: {formatBytes(b.neededBytes)}</Small> : null}
          {b.code === 'permission' && !b.canAsk ? <Button title="Abrir ajustes" kind="secondary" onPress={() => Linking.openSettings()} /> : null}
        </Card>
      ))}
      {pf?.warnings.map((w) => (
        <Card key={w.code} tone="warn">
          <P>{w.message}</P>
          {w.code === 'battery_optimization' && Platform.OS === 'android' ? (
            <Button title="Ver otimização de bateria" kind="secondary" onPress={() => RespiraRecorder?.openBatteryOptimizationSettings()} />
          ) : null}
        </Card>
      ))}

      <Small>
        Qualidade: {preset.label} · cerca de {formatBytes(bytesPerHour(preset) * 8)} por noite de 8 h
        {pf && pf.freeBytes >= 0 ? ` · livre: ${formatBytes(pf.freeBytes)}` : ''}
      </Small>

      <Button
        title="Começar a gravar"
        big
        loading={busy}
        disabled={!RespiraRecorder}
        accessibilityHint="Inicia a gravação do áudio do quarto. Você pode bloquear a tela depois."
        onPress={start}
      />
      <Small>O áudio fica apenas neste aparelho. A gravação não é um monitor de emergência.</Small>
      <View style={{ height: 8, backgroundColor: t.bg }} />
    </Screen>
  );
}

function LevelBar({ dbfs, active }: { dbfs: number; active: boolean }) {
  const t = useTheme();
  const pct = active ? Math.max(0, Math.min(1, (dbfs + 90) / 80)) : 0;
  return (
    <View accessibilityLabel="Indicador de nível do microfone" style={{ height: 10, borderRadius: 5, backgroundColor: t.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: t.accent }} />
    </View>
  );
}

export function friendlyError(e: any): string {
  const code = e?.code ?? '';
  if (code === 'permission_denied') return 'O acesso ao microfone não foi concedido.';
  if (code === 'already_recording') return 'Já existe uma gravação em andamento.';
  if (code === 'fgs_start_failed') return 'O Android não permitiu iniciar a gravação. Abra o app, mantenha-o visível e tente de novo.';
  return 'Tente novamente. Se o problema continuar, reinicie o telefone.';
}
