import { requireOptionalNativeModule } from 'expo';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'interrupted' | 'stopping';

export interface RecorderStatus {
  state: RecorderState;
  sessionId: string | null;
  sessionDir: string | null;
  startedAtMs: number;
  capturedMs: number;
  segmentIndex: number;
  /** Nível do último segundo em dBFS (escala digital relativa, não calibrada). */
  levelDbfs: number;
}

export interface StartOptions {
  sampleRate?: number;
  bitRate?: number;
  segmentSeconds?: number;
  minFreeBytes?: number;
  maxDurationMs?: number;
}

export interface ProbeResult {
  ok: boolean;
  durationMs: number;
  validBytes: number;
}

type Events = {
  onStatus: (s: RecorderStatus) => void;
  onSegment: (e: { idx: number; file: string; durationMs: number }) => void;
  onStopped: (e: { sessionId: string | null; reason: string }) => void;
  onError: (e: { code: string; message: string }) => void;
};

interface NativeRecorder {
  platformContainer: 'adts' | 'm4a';
  fileExtension: 'aac' | 'm4a';
  getRecordingsRoot(): string;
  getStatus(): RecorderStatus;
  getFreeDiskBytes(): number;
  getBatteryPercent(): number;
  isIgnoringBatteryOptimizations(): boolean;
  /** iOS: exclui o caminho do backup do iCloud (dados de saúde). Android: sem efeito (backup desligado). */
  excludeFromBackup(path: string): boolean;
  openBatteryOptimizationSettings(): Promise<void>;
  start(sessionId: string, options: StartOptions): Promise<string>;
  stop(reason?: string | null): Promise<boolean>;
  probeSegment(path: string): Promise<ProbeResult>;
  addListener<K extends keyof Events>(name: K, listener: Events[K]): { remove(): void };
}

/**
 * Módulo nativo local. É `null` no Expo Go e na web: a gravação noturna exige
 * development build (npx expo run:android / run:ios ou EAS development build).
 */
export const RespiraRecorder = requireOptionalNativeModule<NativeRecorder>('RespiraRecorder');

export function isRecorderAvailable(): boolean {
  return RespiraRecorder != null;
}
