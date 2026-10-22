// Testes das migrações em Postgres embutido (PGlite), sem servidor.
// Simula o mínimo do Supabase: schema auth (users, uid()), papéis anon/authenticated e storage.
// Execução: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, '..', 'migrations');

const STUB = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id bigserial primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/') $$;
grant usage on schema auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

const GRANTS = `
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.module_flags to anon;
grant select, insert, delete on storage.objects to authenticated;
grant usage on all sequences in schema storage to authenticated;
`;

const U = {
  alice: '00000000-0000-0000-0000-00000000000a',
  bob: '00000000-0000-0000-0000-00000000000b',
  pro: '00000000-0000-0000-0000-0000000000c0',
  editor: '00000000-0000-0000-0000-0000000000e0',
  reviewer: '00000000-0000-0000-0000-0000000000f0',
};

const db = new PGlite();
await db.exec(STUB);
for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(migDir, f), 'utf8'));
}
await db.exec(GRANTS);
for (const id of Object.values(U)) await db.query('insert into auth.users (id) values ($1)', [id]);

async function as(user, fn, env = 'development') {
  await db.exec(`set app.environment = '${env}'`);
  await db.exec(`set request.jwt.claim.sub = '${user ?? ''}'`);
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}
const rows = async (sql, p) => (await db.query(sql, p)).rows;
async function rejects(promise, re) {
  let err = null;
  try { await promise; } catch (e) { err = e; }
  assert.ok(err, `esperava erro ${re}`);
  if (re) assert.match(String(err.message), re);
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}

// Preparação como superusuário (equivalente ao backend com service_role)
await db.exec(`update public.module_flags set enabled = true where environment = 'development' and flag in ('cloud_sync','professional_sharing')`);
await db.query(`insert into public.user_roles values ($1,'professional'), ($2,'content_editor'), ($3,'content_reviewer')`, [U.pro, U.editor, U.reviewer]);
await db.query(`insert into public.reviewers (user_id, full_name, credential, credential_verified_at) values ($1, 'Revisora Teste', 'CRFa-TESTE', now())`, [U.reviewer]);

console.log('Supabase RLS / regras');

await test('sem consentimento de sincronização, o usuário não envia dados', async () => {
  await rejects(as(U.alice, () => rows(`insert into public.sessions (local_id, status, started_at) values ('s1','completed', now())`)), /row-level security/);
});

await test('com consentimento, grava e lê apenas os próprios dados', async () => {
  await as(U.alice, async () => {
    await rows(`insert into public.consents (kind, version, granted) values ('cloud_sync','2026-10-21', true)`);
    await rows(`insert into public.sessions (local_id, status, started_at, wall_ms, captured_ms) values ('s1','completed', now(), 1000, 900)`);
  });
  await as(U.bob, async () => {
    await rows(`insert into public.consents (kind, version, granted) values ('cloud_sync','2026-10-21', true)`);
    await rows(`insert into public.sessions (local_id, status, started_at) values ('b1','completed', now())`);
  });
  const a = await as(U.alice, () => rows('select local_id from public.sessions'));
  assert.deepEqual(a.map((r) => r.local_id), ['s1']);
  const b = await as(U.bob, () => rows('select local_id from public.sessions'));
  assert.deepEqual(b.map((r) => r.local_id), ['b1']);
});

await test('não é possível gravar em nome de outro usuário', async () => {
  await rejects(as(U.bob, () => rows(`insert into public.sessions (user_id, local_id, status, started_at) values ($1,'x','completed', now())`, [U.alice])), /row-level security/);
});

await test('capturado não pode exceder a duração da sessão', async () => {
  await rejects(as(U.alice, () => rows(`insert into public.sessions (local_id, status, started_at, wall_ms, captured_ms) values ('s2','completed', now(), 100, 200)`)), /check/i);
});

await test('profissional não vê nada sem permissão do paciente', async () => {
  const r = await as(U.pro, () => rows('select * from public.sessions'));
  assert.equal(r.length, 0);
});

await test('compartilhamento exige consentimento específico', async () => {
  await rejects(
    as(U.alice, () => rows(`insert into public.share_grants (professional_id, scopes, expires_at) values ($1, array['sessions'], now() + interval '7 days')`, [U.pro])),
    /row-level security/,
  );
});

await test('profissional vê apenas o escopo concedido e perde acesso ao revogar', async () => {
  await as(U.alice, async () => {
    await rows(`insert into public.consents (kind, version, granted) values ('sharing','2026-10-21', true)`);
    await rows(`insert into public.share_grants (professional_id, scopes, expires_at) values ($1, array['sessions'], now() + interval '7 days')`, [U.pro]);
    await rows(`insert into public.diary_entries (night, data) values ('2026-10-20', '{"rested":3}')`);
  });
  assert.equal((await as(U.pro, () => rows('select * from public.sessions'))).length, 1);
  assert.equal((await as(U.pro, () => rows('select * from public.diary_entries'))).length, 0, 'diário fora do escopo');
  await as(U.alice, () => rows('update public.share_grants set revoked_at = now()'));
  assert.equal((await as(U.pro, () => rows('select * from public.sessions'))).length, 0);
});

await test('editor/revisor de conteúdo não tem acesso a dados de usuários', async () => {
  for (const u of [U.editor, U.reviewer]) {
    assert.equal((await as(u, () => rows('select * from public.sessions'))).length, 0);
    assert.equal((await as(u, () => rows('select * from public.diary_entries'))).length, 0);
  }
});

await test('usuário não consegue se atribuir papéis', async () => {
  await rejects(as(U.bob, () => rows(`insert into public.user_roles values ($1, 'admin')`, [U.bob])), /row-level security|permission/);
});

await test('flags: cliente só lê; diagnóstico não liga em produção; clínico em produção exige análise regulatória', async () => {
  await rejects(as(U.alice, () => rows(`update public.module_flags set enabled = true`)).then((r) => { if (r.length === 0) throw new Error('row-level security: sem efeito'); }), /row-level security/);
  const still = await rows(`select count(*)::int c from public.module_flags where enabled and flag = 'diagnostic'`);
  assert.equal(still[0].c, 0);
  await rejects(db.exec(`update public.module_flags set enabled = true where environment='production' and flag='diagnostic'`), /diagnostic_never_in_production/);
  await rejects(db.exec(`update public.module_flags set enabled = true where environment='production' and flag='clinical_content'`), /clinical_in_production_requires_assessment/);
});

await test('fluxo editorial: editor cria rascunho; não publica; revisor verificado publica; publicado é imutável', async () => {
  const [ex] = await as(U.editor, () => rows(`insert into public.exercises (slug) values ('ex-a') returning id`));
  const content = { name: 'Exercício A', stop_if: ['dor'], references: [{ label: 'ref', url: 'https://example.org' }] };
  const [v] = await as(U.editor, () => rows(`insert into public.exercise_versions (exercise_id, version, content, dose) values ($1, 1, $2, '{"reps":10}') returning id, status`, [ex.id, content]));
  assert.equal(v.status, 'draft');
  await rejects(as(U.editor, () => rows(`update public.exercise_versions set status='published' where id=$1`, [v.id])), /Transição não permitida/);
  await as(U.editor, () => rows(`update public.exercise_versions set status='in_review' where id=$1`, [v.id]));
  await rejects(as(U.editor, () => rows(`update public.exercise_versions set status='published' where id=$1`, [v.id])), /Apenas revisor/);
  await as(U.reviewer, () => rows(`update public.exercise_versions set status='published' where id=$1`, [v.id]));
  const [pub] = await rows(`select status, reviewer_id, approved_at from public.exercise_versions where id=$1`, [v.id]);
  assert.equal(pub.status, 'published');
  assert.equal(pub.reviewer_id, U.reviewer);
  assert.ok(pub.approved_at);
  await rejects(as(U.editor, () => rows(`update public.exercise_versions set dose='{"reps":30}' where id=$1`, [v.id])), /não pode ser alterado/);
  const hist = await rows(`select from_status, to_status from public.content_history where exercise_version_id=$1 order by id`, [v.id]);
  assert.deepEqual(hist.map((h) => `${h.from_status}->${h.to_status}`), ['null->draft', 'draft->in_review', 'in_review->published']);
});

await test('conteúdo publicado só aparece para usuários quando o módulo clínico está ligado no servidor', async () => {
  assert.equal((await as(U.alice, () => rows('select * from public.exercise_versions'))).length, 0);
  await db.exec(`update public.module_flags set enabled = true where environment='development' and flag='clinical_content'`);
  assert.equal((await as(U.alice, () => rows('select * from public.exercise_versions'))).length, 1);
  assert.equal((await as(U.alice, () => rows('select * from public.exercise_versions'), 'production')).length, 0);
});

await test('demonstração nunca é publicada; incompleto não entra em revisão', async () => {
  const [ex] = await as(U.editor, () => rows(`insert into public.exercises (slug) values ('demo') returning id`));
  const [v] = await as(U.editor, () => rows(`insert into public.exercise_versions (exercise_id, version, content, dose, is_demo) values ($1, 1, '{"name":"d","stop_if":["x"],"references":[{"l":1}]}', '{"reps":1}', true) returning id`, [ex.id]));
  await as(U.editor, () => rows(`update public.exercise_versions set status='in_review' where id=$1`, [v.id]));
  await rejects(as(U.reviewer, () => rows(`update public.exercise_versions set status='published' where id=$1`, [v.id])), /demonstração|demo_never_published/);
  const [v2] = await as(U.editor, () => rows(`insert into public.exercise_versions (exercise_id, version, content) values ($1, 2, '{"name":"sem dose"}') returning id`, [ex.id]));
  await rejects(as(U.editor, () => rows(`update public.exercise_versions set status='in_review' where id=$1`, [v2.id])), /incompleto/);
});

await test('storage: só o dono acessa a própria pasta', async () => {
  await as(U.alice, () => rows(`insert into storage.objects (bucket_id, name) values ('session-clips', $1)`, [`${U.alice}/clip1.m4a`]));
  await rejects(as(U.bob, () => rows(`insert into storage.objects (bucket_id, name) values ('session-clips', $1)`, [`${U.alice}/x.m4a`])), /row-level security/);
  assert.equal((await as(U.bob, () => rows(`select * from storage.objects`))).length, 0);
});

await test('auditoria não aceita texto livre longo (sem conteúdo sensível)', async () => {
  await rejects(db.query(`insert into public.audit_log (action, target) values ('professional_read', $1)`, ['x'.repeat(200)]), /check/i);
});

await test('exclusão de conta remove dados em cascata', async () => {
  await db.query('delete from auth.users where id=$1', [U.bob]);
  assert.equal((await rows(`select count(*)::int c from public.sessions where user_id=$1`, [U.bob]))[0].c, 0);
});

console.log(`${passed} testes de banco aprovados${process.exitCode ? ' (com falhas)' : ''}`);
