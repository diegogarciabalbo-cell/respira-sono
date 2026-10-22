export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 1) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Data da "noite": gravações iniciadas antes das 12h contam para a noite anterior. */
export function nightKey(epochMs: number): string {
  const d = new Date(epochMs);
  if (d.getHours() < 12) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return `${Math.round(ratio * 100)}%`;
}
