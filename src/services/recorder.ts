import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Platform } from 'react-native';
import { RespiraRecorder } from '../native/recorder';
import { createSession, markFailed, reconcileSession } from '../db/sessions';
import { DbLike } from '../db/schema';
import { minimumFreeBytesToStart, QualityPreset, RECORDING_PRESETS } from '../domain/storage';
import { sessionFiles } from './files';

export type PreflightIssue =
  | { code: 'module_missing'; message: string }
  | { code: 'permission'; message: string; canAsk: boolean }
  | { code: 'storage'; message: string; freeBytes: number; neededBytes: number }
  | { code: 'battery_low'; message: string; percent: number }
  | { code: 'battery_optimization'; message: string };

export interface Preflight {
  blocking: PreflightIssue[];
  warnings: PreflightIssue[];
  freeBytes: number;
  batteryPercent: number;
}

export async function preflight(preset: QualityPreset): Promise<Preflight> {
  const blocking: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];
  if (!RespiraRecorder) {
    return {
      blocking: [{
        code: 'module_missing',
        message: 'A gravação noturna precisa da versão instalada do app (development build). Ela não funciona no Expo Go nem na web.',
      }],
      warnings: [], freeBytes: -1, batteryPercent: -1,
    };
  }
  const perm = await getRecordingPermissionsAsync();
  if (!perm.granted) {
    blocking.push({
      code: 'permission',
      canAsk: perm.canAskAgain,
      message: perm.canAskAgain
        ? 'Precisamos de acesso ao microfone para gravar a noite.'
        : 'O acesso ao microfone foi negado. Ative-o nos ajustes do sistema para gravar.',
    });
  }
  const freeBytes = RespiraRecorder.getFreeDiskBytes();
  const needed = minimumFreeBytesToStart(RECORDING_PRESETS[preset]);
  if (freeBytes >= 0 && freeBytes < needed) {
    blocking.push({ code: 'storage', freeBytes, neededBytes: needed, message: 'Pouco espaço livre para uma noite inteira de gravação.' });
  }
  const battery = RespiraRecorder.getBatteryPercent();
  if (battery >= 0 && battery < 40) {
    warnings.push({ code: 'battery_low', percent: battery, message: `Bateria em ${battery}%. Recomendamos deixar o telefone carregando durante a noite.` });
  }
  if (Platform.OS === 'android' && !RespiraRecorder.isIgnoringBatteryOptimizations()) {
    warnings.push({
      code: 'battery_optimization',
      message: 'Alguns fabricantes encerram apps em segundo plano para economizar bateria. Se a gravação parar sozinha, revise a otimização de bateria do RESPIRA Sono.',
    });
  }
  return { blocking, warnings, freeBytes, batteryPercent: battery };
}

export async function askMicPermission(): Promise<boolean> {
  const r = await requestRecordingPermissionsAsync();
  return r.granted;
}

function newSessionId(): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `s_${Date.now().toString(36)}_${rnd}`;
}

/** Inicia uma sessão. Deve ser chamado a partir de um toque do usuário, com o app visível. */
export async function startNight(
  db: DbLike,
  opts: { preset: QualityPreset; kind?: 'night' | 'mic_test'; phonePosition?: string | null; maxDurationMs?: number },
): Promise<string> {
  if (!RespiraRecorder) throw new Error('Gravador indisponível nesta versão do app.');
  const id = newSessionId();
  const preset = RECORDING_PRESETS[opts.preset];
  const dir = `${RespiraRecorder.getRecordingsRoot()}/${id}`;
  await createSession(db, { id, kind: opts.kind ?? 'night', startedAt: Date.now(), dir, phonePosition: opts.phonePosition });
  try {
    await RespiraRecorder.start(id, {
      sampleRate: preset.sampleRate,
      bitRate: preset.bitRate,
      segmentSeconds: opts.kind === 'mic_test' ? 30 : 300,
      minFreeBytes: 150 * 1024 * 1024,
      maxDurationMs: opts.maxDurationMs ?? 12 * 3600 * 1000,
    });
  } catch (e: any) {
    await markFailed(db, id, e?.code ?? 'start_failed');
    throw e;
  }
  return id;
}

export async function stopNight(db: DbLike, id: string): Promise<void> {
  if (RespiraRecorder) await RespiraRecorder.stop('user');
  await waitForIdle(8000);
  await reconcileSession(db, sessionFiles, id, { isActive: false });
}

export function waitForIdle(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!RespiraRecorder || RespiraRecorder.getStatus().state === 'idle') return resolve();
    const sub = RespiraRecorder.addListener('onStopped', () => {
      sub.remove();
      clearTimeout(t);
      resolve();
    });
    const t = setTimeout(() => {
      sub.remove();
      resolve();
    }, timeoutMs);
  });
}

export function activeSessionId(): string | null {
  if (!RespiraRecorder) return null;
  const s = RespiraRecorder.getStatus();
  return s.state === 'idle' ? null : s.sessionId;
}
