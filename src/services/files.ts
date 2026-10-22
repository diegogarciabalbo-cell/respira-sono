import { Directory, File, Paths } from 'expo-file-system';
import { RespiraRecorder } from '../native/recorder';
import { SessionFiles } from '../db/sessions';

const toUri = (p: string) => (p.startsWith('file://') ? p : `file://${p}`);

export const sessionFiles: SessionFiles = {
  async readJournal(dir) {
    const f = new File(toUri(dir), 'journal.jsonl');
    if (!f.exists) return null;
    return f.text();
  },
  async probe(path) {
    if (!RespiraRecorder) return { ok: false, durationMs: 0, validBytes: 0 };
    return RespiraRecorder.probeSegment(path.replace(/^file:\/\//, ''));
  },
  join: (dir, file) => `${dir.replace(/\/$/, '')}/${file}`,
  async deleteDir(dir) {
    const d = new Directory(toUri(dir));
    if (d.exists) d.delete();
  },
};

export function segmentUri(dir: string, file: string) {
  return toUri(sessionFiles.join(dir, file));
}

/** Tamanho em disco de uma sessão (para a tela de armazenamento). */
export function dirSize(dir: string): number {
  const d = new Directory(toUri(dir));
  if (!d.exists) return 0;
  let total = 0;
  for (const item of d.list()) if (item instanceof File) total += item.size ?? 0;
  return total;
}

export function freeDiskBytes(): number {
  if (RespiraRecorder) return RespiraRecorder.getFreeDiskBytes();
  try {
    return Paths.availableDiskSpace;
  } catch {
    return -1;
  }
}

export async function deleteAllRecordings(): Promise<void> {
  if (!RespiraRecorder) return;
  const root = new Directory(toUri(RespiraRecorder.getRecordingsRoot()));
  if (root.exists) root.delete();
}
