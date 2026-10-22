/**
 * Camada B — qualidade do sinal e atividade sonora.
 *
 * Trabalha sobre o nível por segundo (dBFS, escala digital relativa) gerado pelo gravador.
 * NÃO identifica ronco: "atividade sonora" inclui fala, ventilador, TV, animais, outra pessoa etc.
 * Serve para (1) avaliar se a gravação é utilizável e (2) apontar trechos para o usuário ouvir.
 */

export interface LevelTrack {
  /** início do segmento (epoch ms) */
  startAt: number;
  /** nível médio de cada segundo em dBFS */
  levels: number[];
}

export interface SignalSummary {
  analyzedSeconds: number;
  /** segundos de silêncio digital (microfone mudo/bloqueado) — inutilizáveis */
  digitalSilenceSeconds: number;
  usableSeconds: number;
  noiseFloorDbfs: number | null;
  activeSeconds: number;
  /** atividade / utilizável, 0–1 */
  activeRatio: number | null;
  /** fração de segundos em que o nível ficou muito perto do máximo digital */
  nearClippingRatio: number;
  quality: 'boa' | 'limitada' | 'insuficiente';
  qualityNotes: string[];
  highlights: Highlight[];
  /** série reduzida para a linha do tempo (média por minuto) */
  timeline: { at: number; dbfs: number | null }[];
}

export interface Highlight {
  startAt: number;
  endAt: number;
  peakDbfs: number;
  activeSeconds: number;
}

export const SIGNAL_ANALYZER = {
  id: 'signal-activity',
  version: '0.1.0',
  description:
    'Atividade sonora acima do ruído de fundo (limiar relativo). Não classifica o tipo de som e não é medida calibrada.',
};

export const DIGITAL_SILENCE_DBFS = -100;
export const ACTIVITY_MARGIN_DB = 10;
export const NEAR_CLIP_DBFS = -3;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

export function summarizeSignal(tracks: LevelTrack[], opts: { highlightCount?: number; highlightWindowS?: number } = {}): SignalSummary {
  const perSecond: { at: number; db: number }[] = [];
  for (const t of tracks) t.levels.forEach((db, i) => perSecond.push({ at: t.startAt + i * 1000, db }));
  perSecond.sort((a, b) => a.at - b.at);

  const analyzedSeconds = perSecond.length;
  const usable = perSecond.filter((s) => s.db > DIGITAL_SILENCE_DBFS);
  const digitalSilenceSeconds = analyzedSeconds - usable.length;
  const sorted = usable.map((s) => s.db).sort((a, b) => a - b);
  const floor = sorted.length ? percentile(sorted, 0.2) : null;
  const threshold = floor == null ? null : floor + ACTIVITY_MARGIN_DB;
  const active = threshold == null ? [] : usable.filter((s) => s.db >= threshold);
  const nearClip = usable.filter((s) => s.db >= NEAR_CLIP_DBFS).length;

  const qualityNotes: string[] = [];
  let quality: SignalSummary['quality'] = 'boa';
  if (analyzedSeconds === 0) {
    quality = 'insuficiente';
    qualityNotes.push('Não há áudio registrado para avaliar.');
  } else {
    const silenceRatio = digitalSilenceSeconds / analyzedSeconds;
    if (silenceRatio > 0.5) {
      quality = 'insuficiente';
      qualityNotes.push('Grande parte do áudio veio sem sinal. O microfone pode ter sido bloqueado ou silenciado.');
    } else if (silenceRatio > 0.1) {
      quality = 'limitada';
      qualityNotes.push('Parte do áudio veio sem sinal (microfone possivelmente silenciado).');
    }
    if (usable.length && nearClip / usable.length > 0.05) {
      if (quality === 'boa') quality = 'limitada';
      qualityNotes.push('Sons muito fortes saturaram o microfone em alguns momentos. Afaste um pouco o telefone.');
    }
    if (floor != null && floor > -30) {
      if (quality === 'boa') quality = 'limitada';
      qualityNotes.push('Ruído de fundo alto (ventilador, ar-condicionado ou TV podem dificultar a escuta).');
    }
  }

  // Trechos destacados: janelas com mais segundos ativos, separadas entre si.
  const win = (opts.highlightWindowS ?? 30) * 1000;
  const want = opts.highlightCount ?? 5;
  const candidates: Highlight[] = [];
  if (threshold != null) {
    let j = 0;
    for (let i = 0; i < usable.length; i++) {
      const start = usable[i].at;
      while (j < usable.length && usable[j].at < start + win) j++;
      const slice = usable.slice(i, j);
      const act = slice.filter((s) => s.db >= threshold);
      if (act.length >= 3) {
        candidates.push({
          startAt: start,
          endAt: start + win,
          peakDbfs: Math.max(...slice.map((s) => s.db)),
          activeSeconds: act.length,
        });
      }
    }
  }
  candidates.sort((a, b) => b.activeSeconds - a.activeSeconds || b.peakDbfs - a.peakDbfs);
  const highlights: Highlight[] = [];
  for (const c of candidates) {
    if (highlights.length >= want) break;
    if (highlights.some((h) => Math.abs(h.startAt - c.startAt) < 5 * 60_000)) continue;
    highlights.push(c);
  }
  highlights.sort((a, b) => a.startAt - b.startAt);

  // Linha do tempo por minuto (lacunas ficam como null, sem preenchimento).
  const timeline: { at: number; dbfs: number | null }[] = [];
  if (perSecond.length) {
    const t0 = Math.floor(perSecond[0].at / 60_000) * 60_000;
    const t1 = perSecond[perSecond.length - 1].at;
    const buckets = new Map<number, number[]>();
    for (const s of usable) {
      const k = Math.floor(s.at / 60_000) * 60_000;
      const arr = buckets.get(k) ?? [];
      arr.push(s.db);
      buckets.set(k, arr);
    }
    for (let t = t0; t <= t1; t += 60_000) {
      const arr = buckets.get(t);
      timeline.push({ at: t, dbfs: arr && arr.length ? Math.max(...arr) : null });
    }
  }

  return {
    analyzedSeconds,
    digitalSilenceSeconds,
    usableSeconds: usable.length,
    noiseFloorDbfs: floor,
    activeSeconds: active.length,
    activeRatio: usable.length ? active.length / usable.length : null,
    nearClippingRatio: usable.length ? nearClip / usable.length : 0,
    quality,
    qualityNotes,
    highlights,
    timeline,
  };
}
