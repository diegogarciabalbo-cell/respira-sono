import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { RespiraRecorder } from '../native/recorder';
import { deleteSession, getSession } from '../db/sessions';
import { recordConsent } from '../db/profile';
import { askMicPermission, preflight, startNight, stopNight } from '../services/recorder';
import { segmentUri, sessionFiles } from '../services/files';
import { useApp } from '../state/AppContext';
import { Button, Card, H1, P, Screen, Small } from '../ui/components';

const TEST_MS = 8000;

/** Grava ~8 s pelo mesmo caminho nativo da noite, reproduz e apaga. */
export default function MicTest() {
  const { db, prefs, setPrefs, recorder, reloadConsents } = useApp();
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'recording' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [peak, setPeak] = useState(-120);
  const idRef = useRef<string | null>(null);
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (phase === 'recording' && recorder) setPeak((p) => Math.max(p, recorder.levelDbfs));
  }, [recorder, phase]);

  useEffect(() => () => {
    // Ao sair, apaga o áudio de teste.
    if (db && idRef.current) deleteSession(db, sessionFiles, idRef.current).catch(() => {});
  }, [db]);

  async function run() {
    if (!db) return;
    let p = await preflight(prefs.preset);
    if (p.blocking.some((b) => b.code === 'permission')) {
      const ok = await askMicPermission();
      await recordConsent(db, 'microphone', ok);
      await reloadConsents();
      p = await preflight(prefs.preset);
    }
    const blocking = p.blocking.filter((b) => b.code !== 'storage');
    if (blocking.length) {
      setPhase('error');
      setMsg(blocking[0].message);
      return;
    }
    setPeak(-120);
    setPhase('recording');
    try {
      const id = await startNight(db, { preset: prefs.preset, kind: 'mic_test', maxDurationMs: TEST_MS + 4000 });
      idRef.current = id;
      // Temporizador de interface para encerrar o teste curto; não controla a captura.
      setTimeout(async () => {
        await stopNight(db, id);
        const s = await getSession(db, id);
        const seg = s?.segments.find((x) => x.status === 'complete' || x.status === 'recovered');
        if (s?.session.dir && seg) {
          setUri(segmentUri(s.session.dir, seg.file));
          setPhase('done');
          await setPrefs({ micTested: true });
        } else {
          setPhase('error');
          setMsg('Não recebemos áudio do microfone. Verifique se ele não está coberto ou em uso por outro app.');
        }
      }, TEST_MS);
    } catch {
      setPhase('error');
      setMsg('Não foi possível iniciar o teste.');
    }
  }

  return (
    <Screen>
      <H1>Teste de microfone</H1>
      <P muted>Coloque o telefone onde ele ficará à noite. Vamos gravar alguns segundos: respire normalmente ou fale baixo. Depois você ouve o resultado.</P>
      {!RespiraRecorder ? <Card tone="warn"><P>Disponível apenas na versão instalada do app.</P></Card> : null}
      {phase === 'recording' ? (
        <Card tone="accent"><P>Gravando por alguns segundos…</P></Card>
      ) : null}
      {phase === 'done' ? (
        <Card tone="accent">
          <P>Gravação de teste concluída. Ouça e confira se o som está claro.</P>
          <Small>
            {peak <= -100
              ? 'Nenhum sinal detectado: o microfone pode estar bloqueado.'
              : peak > -3
                ? 'O som chegou a saturar. Afaste um pouco o telefone.'
                : 'Sinal recebido.'}
          </Small>
          <Button title={status.playing ? 'Pausar' : 'Ouvir teste'} kind="secondary" onPress={() => (status.playing ? player.pause() : (player.seekTo(0), player.play()))} />
          <Small>O áudio do teste é apagado ao sair desta tela.</Small>
        </Card>
      ) : null}
      {phase === 'error' ? <Card tone="danger"><P>{msg}</P></Card> : null}
      <Button title={phase === 'done' ? 'Testar de novo' : 'Iniciar teste'} disabled={!RespiraRecorder || phase === 'recording'} onPress={run} />
      {phase === 'done' ? <Button title="Concluir" kind="ghost" onPress={() => router.back()} /> : null}
    </Screen>
  );
}
