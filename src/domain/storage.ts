/** Estimativas de armazenamento e retenção. */

export type QualityPreset = 'padrao' | 'alta';

export const RECORDING_PRESETS: Record<QualityPreset, { sampleRate: number; bitRate: number; label: string; rationale: string }> = {
  padrao: {
    sampleRate: 16000,
    bitRate: 32000,
    label: 'Padrão (recomendado)',
    rationale:
      'AAC-LC mono 16 kHz a 32 kbps: boa inteligibilidade para ouvir ronco e respiração (faixa até 8 kHz), ' +
      'compatível com Android e iOS, ~15 MB por hora e mesma taxa usada por classificadores sonoros comuns, o que evita reamostragem na análise futura.',
  },
  alta: {
    sampleRate: 44100,
    bitRate: 64000,
    label: 'Alta fidelidade',
    rationale: 'AAC-LC mono 44,1 kHz a 64 kbps: mais detalhe acima de 8 kHz, cerca do dobro do espaço.',
  },
};

/** Bytes por hora para AAC-LC: taxa de bits + sobrecarga do contêiner (ADTS: 7 bytes por quadro de 1024 amostras). */
export function bytesPerHour(preset: { sampleRate: number; bitRate: number }): number {
  const payload = (preset.bitRate / 8) * 3600;
  const framesPerHour = (preset.sampleRate / 1024) * 3600;
  return Math.round(payload + framesPerHour * 7);
}

export function estimateNightBytes(hours: number, preset: { sampleRate: number; bitRate: number }): number {
  return Math.round(bytesPerHour(preset) * hours);
}

/** Espaço livre mínimo para começar: uma noite de 10 h + margem de segurança do sistema. */
export function minimumFreeBytesToStart(preset: { sampleRate: number; bitRate: number }): number {
  return estimateNightBytes(10, preset) + 300 * 1024 * 1024;
}

export function formatBytes(b: number): string {
  if (!Number.isFinite(b) || b < 0) return '—';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(b < 10 * 1024 ** 2 ? 1 : 0).replace('.', ',')} MB`;
  return `${(b / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
}

export interface RetainableSession {
  id: string;
  endedAt: number | null;
  startedAt: number;
  keep: boolean;
  isDemo?: boolean;
}

/**
 * Sessões cujo áudio deve ser apagado pela política de retenção.
 * `keepDays = null` significa manter até o usuário apagar. Sessões marcadas para manter são preservadas.
 * A retenção remove o áudio; o resumo e as métricas ficam até o usuário excluir a sessão.
 */
export function sessionsToPurge(sessions: RetainableSession[], keepDays: number | null, now: number): string[] {
  if (keepDays == null) return [];
  const limit = now - keepDays * 24 * 3600 * 1000;
  return sessions.filter((s) => !s.keep && (s.endedAt ?? s.startedAt) < limit).map((s) => s.id);
}
