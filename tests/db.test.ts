import { upsertDiary, getDiary } from '../src/db/diary';
import { currentConsents, exportLocalData, recordConsent, saveProfile, wipeLocalData } from '../src/db/profile';
import { migrate, MIGRATIONS } from '../src/db/schema';
import { createSession, deleteSession, getSession, reconcileSession, recoverStaleSessions, SessionFiles } from '../src/db/sessions';
import { createTestDb, JournalBuilder } from './helpers/nodeDb';

const T0 = Date.UTC(2026, 9, 21, 2, 0, 0);
const MIN = 60_000;

function fakeFiles(journals: Record<string, string>, probes: Record<string, { ok: boolean; durationMs: number; validBytes: number }> = {}) {
  const deleted: string[] = [];
  const files: SessionFiles = {
    readJournal: async (dir) => journals[dir] ?? null,
    probe: async (p) => probes[p] ?? { ok: false, durationMs: 0, validBytes: 0 },
    join: (d, f) => `${d}/${f}`,
    deleteDir: async (d) => { deleted.push(d); },
  };
  return { files, deleted };
}

async function freshDb() {
  const db = createTestDb();
  await migrate(db);
  return db;
}

test('migrações são idempotentes', async () => {
  const db = await freshDb();
  expect(await migrate(db)).toBe(MIGRATIONS.length);
});

test('reconciliação de sessão completa grava segmentos, cobertura e resultado de sinal', async () => {
  const db = await freshDb();
  const j = new JournalBuilder().start(T0);
  for (let i = 0; i < 4; i++) j.segment(i, T0 + i * 5 * MIN, 5 * MIN, Array(300).fill(-55));
  j.add('interruption_begin', T0 + 20 * MIN, { reason: 'silenced_by_system' });
  j.add('interruption_end', T0 + 25 * MIN, { reason: 'silenced_by_system' });
  j.segment(4, T0 + 25 * MIN, 5 * MIN, Array(300).fill(-55));
  j.stop(T0 + 30 * MIN);
  const { files } = fakeFiles({ '/r/s1': j.text() });
  await createSession(db, { id: 'sess_000001', kind: 'night', startedAt: T0, dir: '/r/s1' });
  const res = await reconcileSession(db, files, 'sess_000001');
  expect(res?.status).toBe('completed');
  const full = await getSession(db, 'sess_000001');
  expect(full!.segments).toHaveLength(5);
  expect(full!.session.captured_ms).toBe(25 * MIN);
  expect(full!.session.wall_ms).toBe(30 * MIN);
  expect(full!.gaps).toHaveLength(1);
  expect(full!.gaps[0].reason).toBe('silenced_by_system');
  expect(full!.signal?.usableSeconds).toBe(1500);
  // Classificador de ronco registrado como indisponível, nunca com número.
  const snore = await db.getFirstAsync<any>("SELECT * FROM acoustic_results WHERE analyzer='snore-classifier'");
  expect(snore.status).toBe('unavailable');
  expect(snore.result_json).toBeNull();
});

test('recuperação na abertura: sessão "gravando" sem gravador ativo vira interrompida com segmentos válidos', async () => {
  const db = await freshDb();
  const j = new JournalBuilder().start(T0).segment(0, T0, 5 * MIN).openOnly(1, T0 + 5 * MIN);
  const { files } = fakeFiles({ '/r/s2': j.text() }, { '/r/s2/seg_0001.aac': { ok: true, durationMs: 2 * MIN, validBytes: 500 } });
  await createSession(db, { id: 'sess_000002', kind: 'night', startedAt: T0, dir: '/r/s2' });
  const recovered = await recoverStaleSessions(db, files, null);
  expect(recovered).toEqual(['sess_000002']);
  const s = (await getSession(db, 'sess_000002'))!;
  expect(s.session.status).toBe('interrupted');
  expect(s.session.stop_reason).toBe('app_terminated');
  expect(s.session.captured_ms).toBe(7 * MIN);
  expect(s.segments.map((x) => x.status)).toEqual(['complete', 'recovered']);
});

test('sessão ativa não é marcada como interrompida', async () => {
  const db = await freshDb();
  const { files } = fakeFiles({ '/r/s3': new JournalBuilder().start(T0).segment(0, T0, 5 * MIN).openOnly(1, T0 + 5 * MIN).text() });
  await createSession(db, { id: 'sess_000003', kind: 'night', startedAt: T0, dir: '/r/s3' });
  expect(await recoverStaleSessions(db, files, 'sess_000003')).toEqual([]);
  const s = await db.getFirstAsync<any>("SELECT status FROM sessions WHERE id='sess_000003'");
  expect(s.status).toBe('recording');
});

test('sem áudio algum => falha, sem números fictícios', async () => {
  const db = await freshDb();
  const { files } = fakeFiles({});
  await createSession(db, { id: 'sess_000004', kind: 'night', startedAt: T0, dir: '/r/s4' });
  await reconcileSession(db, files, 'sess_000004');
  const s = await db.getFirstAsync<any>("SELECT * FROM sessions WHERE id='sess_000004'");
  expect(s.status).toBe('failed');
  expect(s.captured_ms).toBe(0);
});

test('exclusão apaga arquivos e registros em cascata, com trilha sem conteúdo', async () => {
  const db = await freshDb();
  const j = new JournalBuilder().start(T0).segment(0, T0, MIN).stop(T0 + MIN);
  const { files, deleted } = fakeFiles({ '/r/s5': j.text() });
  await createSession(db, { id: 'sess_000005', kind: 'night', startedAt: T0, dir: '/r/s5' });
  await reconcileSession(db, files, 'sess_000005');
  await deleteSession(db, files, 'sess_000005');
  expect(deleted).toEqual(['/r/s5']);
  expect(await db.getFirstAsync('SELECT * FROM sessions')).toBeNull();
  expect((await db.getAllAsync('SELECT * FROM segments')).length).toBe(0);
  const req = await db.getFirstAsync<any>('SELECT * FROM deletion_requests');
  expect(req.completed_at).not.toBeNull();
  const logs = await db.getAllAsync<any>('SELECT * FROM audit_log');
  expect(JSON.stringify(logs)).not.toMatch(/levels|symptom|token/i);
});

test('não apaga sessão em gravação', async () => {
  const db = await freshDb();
  const { files } = fakeFiles({});
  await createSession(db, { id: 'sess_000006', kind: 'night', startedAt: T0, dir: '/r/s6' });
  await expect(deleteSession(db, files, 'sess_000006')).rejects.toThrow('Encerre a gravação');
});

test('diário valida horários e escalas e mescla campos', async () => {
  const db = await freshDb();
  await expect(upsertDiary(db, '2026-10-20', { bed_time: '25:00' })).rejects.toThrow('Horário inválido');
  await expect(upsertDiary(db, '2026-10-20', { rested: 7 })).rejects.toThrow('1 a 5');
  await upsertDiary(db, '2026-10-20', { bed_time: '23:10', alcohol: 1 });
  await upsertDiary(db, '2026-10-20', { rested: 4 });
  const d = await getDiary(db, '2026-10-20');
  expect(d).toMatchObject({ bed_time: '23:10', alcohol: 1, rested: 4, source: 'self_report' });
});

test('consentimentos são separados e versionados; revogação vale', async () => {
  const db = await freshDb();
  await recordConsent(db, 'microphone', true);
  await recordConsent(db, 'cloud_sync', true);
  await recordConsent(db, 'cloud_sync', false);
  const c = await currentConsents(db);
  expect(c.microphone).toBe(true);
  expect(c.cloud_sync).toBe(false);
  expect(c.research).toBe(false);
});

test('perfil: menores de 18 bloqueados', async () => {
  const db = await freshDb();
  await expect(saveProfile(db, { age_range: 'under18' })).rejects.toThrow('maiores de 18');
});

test('exportação e exclusão total de dados locais', async () => {
  const db = await freshDb();
  await saveProfile(db, { age_range: '30-44', symptoms: { observedPauses: true } });
  const exp = await exportLocalData(db);
  expect((exp.data.profile as any[]).length).toBe(1);
  await wipeLocalData(db);
  expect(await db.getFirstAsync('SELECT * FROM profile')).toBeNull();
});
