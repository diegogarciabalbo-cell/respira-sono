-- RESPIRA Sono — esquema do servidor (Supabase/Postgres)
-- Princípios:
--  * RLS por proprietário em todos os dados de usuário.
--  * Profissionais só leem dados de pacientes que concederam permissão ativa (escopo, prazo, revogável).
--  * Editor/revisor de conteúdo NÃO tem acesso a gravações nem dados de saúde.
--  * Módulos clínicos (conteúdo clínico, triagem individual, diagnóstico) são liberados apenas pelo servidor;
--    "diagnostic" não pode ser ligado em produção, e módulos clínicos em produção exigem referência
--    a uma análise regulatória registrada.
--  * Auditoria sem áudio, sintomas ou tokens.
--  * Nenhuma tabela de "diagnóstico por IA". Dados estimados pelo app ficam separados de futuros resultados
--    emitidos por profissionais (tabela professional_results, vazia nesta versão).

-- gen_random_uuid() é nativo do Postgres 13+.

-- ---------------------------------------------------------------------------------------------
-- Papéis (atribuídos apenas pelo backend com service_role; usuários não podem se autopromover)
create type public.app_role as enum ('professional', 'content_editor', 'content_reviewer', 'admin');

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
create policy user_roles_self_read on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(r public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = r);
$$;

-- ---------------------------------------------------------------------------------------------
-- Flags de módulos por ambiente (somente leitura para clientes)
create table public.regulatory_assessments (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  summary text not null,              -- ex.: análise de enquadramento conforme RDC Anvisa 657/2022 e normas vigentes
  document_ref text not null,         -- referência ao documento/parecer arquivado
  decided_at date not null,
  created_at timestamptz not null default now()
);
alter table public.regulatory_assessments enable row level security;

create table public.module_flags (
  environment text not null check (environment in ('development', 'staging', 'production')),
  flag text not null check (flag in ('clinical_content', 'individual_triage', 'diagnostic', 'snore_classifier', 'cloud_sync', 'professional_sharing')),
  enabled boolean not null default false,
  regulatory_assessment_id uuid references public.regulatory_assessments(id),
  updated_at timestamptz not null default now(),
  primary key (environment, flag),
  constraint diagnostic_never_in_production check (not (environment = 'production' and flag = 'diagnostic' and enabled)),
  constraint clinical_in_production_requires_assessment check (
    not (environment = 'production' and flag in ('clinical_content', 'individual_triage') and enabled and regulatory_assessment_id is null)
  )
);
alter table public.module_flags enable row level security;
create policy module_flags_read on public.module_flags for select to anon, authenticated using (true);

insert into public.module_flags (environment, flag, enabled)
select e, f, false
from unnest(array['development', 'staging', 'production']) e,
     unnest(array['clinical_content', 'individual_triage', 'diagnostic', 'snore_classifier', 'cloud_sync', 'professional_sharing']) f;

create or replace function public.module_enabled(f text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.module_flags
                   where flag = f and environment = coalesce(current_setting('app.environment', true), 'production')), false);
$$;

-- ---------------------------------------------------------------------------------------------
-- Consentimentos (separados e versionados; histórico imutável)
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('terms', 'microphone', 'room_others_notice', 'cloud_sync', 'sharing', 'research')),
  version text not null,
  granted boolean not null,
  at timestamptz not null default now()
);
alter table public.consents enable row level security;
create policy consents_owner_read on public.consents for select to authenticated using (user_id = auth.uid());
create policy consents_owner_insert on public.consents for insert to authenticated with check (user_id = auth.uid());

create or replace function public.has_consent(uid uuid, k text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select granted from public.consents where user_id = uid and kind = k order by id desc limit 1), false);
$$;

-- ---------------------------------------------------------------------------------------------
-- Compartilhamento com profissional (opcional, escopo escolhido, revogável, com prazo)
create table public.share_grants (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  scopes text[] not null check (scopes <@ array['sessions', 'diary', 'exercises']::text[] and cardinality(scopes) > 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
alter table public.share_grants enable row level security;
create policy share_owner_all on public.share_grants for all to authenticated
  using (patient_id = auth.uid()) with check (patient_id = auth.uid() and public.has_consent(auth.uid(), 'sharing'));
create policy share_professional_read on public.share_grants for select to authenticated using (professional_id = auth.uid());

create or replace function public.can_view(owner uuid, scope text)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or (
    public.module_enabled('professional_sharing') and public.has_role('professional') and exists (
      select 1 from public.share_grants g
      where g.patient_id = owner and g.professional_id = auth.uid() and scope = any(g.scopes)
        and g.revoked_at is null and g.expires_at > now()
    )
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Dados sincronizados (opcional, com consentimento cloud_sync). Áudio completo NÃO é enviado por padrão.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_id text not null,
  status text not null check (status in ('completed', 'interrupted', 'failed')),
  started_at timestamptz not null,
  ended_at timestamptz,
  device text,
  phone_position text,
  sample_rate int,
  wall_ms bigint check (wall_ms >= 0),
  captured_ms bigint check (captured_ms >= 0),
  gap_ms bigint check (gap_ms >= 0),
  coverage real check (coverage between 0 and 1),
  source text not null default 'app_estimate' check (source = 'app_estimate'),
  created_at timestamptz not null default now(),
  unique (user_id, local_id),
  check (captured_ms is null or wall_ms is null or captured_ms <= wall_ms)
);

create table public.session_gaps (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text not null,
  check (end_at >= start_at)
);

create table public.acoustic_results (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  analyzer text not null,
  analyzer_version text not null,
  status text not null check (status in ('available', 'unavailable', 'experimental')),
  result jsonb,
  source text not null default 'app_estimate' check (source = 'app_estimate'),
  created_at timestamptz not null default now(),
  unique (session_id, analyzer, analyzer_version)
);

create table public.diary_entries (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  night date not null,
  data jsonb not null,               -- campos autorrelatados (ver app: src/db/diary.ts)
  source text not null default 'self_report' check (source = 'self_report'),
  updated_at timestamptz not null default now(),
  primary key (user_id, night)
);

create table public.exercise_completions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_version_id uuid,
  completed_at timestamptz not null,
  stopped_early boolean not null default false,
  discomfort smallint check (discomfort between 0 and 10)
);

-- Reservado para fases futuras: resultados emitidos por profissionais, separados dos estimados pelo app.
create table public.professional_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  issued_by uuid not null references auth.users(id),
  kind text not null,
  document_ref text not null,
  issued_at timestamptz not null,
  source text not null default 'professional' check (source = 'professional')
);

do $$
declare t text;
begin
  foreach t in array array['sessions', 'session_gaps', 'acoustic_results', 'diary_entries', 'exercise_completions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy %1$s_owner_write on public.%1$I for insert to authenticated
                      with check (user_id = auth.uid() and public.module_enabled('cloud_sync') and public.has_consent(auth.uid(), 'cloud_sync'))$p$, t);
    execute format('create policy %1$s_owner_update on public.%1$I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy %1$s_owner_delete on public.%1$I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

create policy sessions_read on public.sessions for select to authenticated using (public.can_view(user_id, 'sessions'));
create policy session_gaps_read on public.session_gaps for select to authenticated using (public.can_view(user_id, 'sessions'));
create policy acoustic_results_read on public.acoustic_results for select to authenticated using (public.can_view(user_id, 'sessions'));
create policy diary_read on public.diary_entries for select to authenticated using (public.can_view(user_id, 'diary'));
create policy completions_read on public.exercise_completions for select to authenticated using (public.can_view(user_id, 'exercises'));

alter table public.professional_results enable row level security;
create policy professional_results_patient_read on public.professional_results for select to authenticated using (patient_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Conteúdo de exercícios: fluxo editorial com revisão real
create table public.reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  credential text not null,                 -- ex.: registro no conselho profissional
  credential_verified_at timestamptz,       -- preenchido pelo backend após verificação documental
  verified_by uuid references auth.users(id)
);
alter table public.reviewers enable row level security;
create policy reviewers_public_read on public.reviewers for select to authenticated using (credential_verified_at is not null);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  created_at timestamptz not null default now()
);

create table public.exercise_versions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  version int not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'retired')),
  is_demo boolean not null default false,
  content jsonb not null,                   -- nome, objetivo, público, instruções, mídia+licença, cuidados, contraindicações, motivos para interromper, referências
  dose jsonb,                               -- definida pelo revisor
  reviewer_id uuid references public.reviewers(user_id),
  approved_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (exercise_id, version),
  constraint demo_never_published check (not (is_demo and status = 'published'))
);

create table public.content_history (
  id bigint generated always as identity primary key,
  exercise_version_id uuid not null references public.exercise_versions(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor uuid,
  at timestamptz not null default now(),
  note text
);

create or replace function public.enforce_editorial_flow()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  allowed boolean;
  r public.reviewers;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'Nova versão deve começar como rascunho'; end if;
    new.reviewer_id := null; new.approved_at := null;
    return new;
  end if;

  -- Conteúdo publicado/retirado é imutável: mudanças exigem nova versão.
  if old.status in ('published', 'retired') and (new.content is distinct from old.content or new.dose is distinct from old.dose) then
    raise exception 'Conteúdo publicado não pode ser alterado; crie uma nova versão';
  end if;
  -- Mudança material durante a revisão devolve para rascunho.
  if old.status = 'in_review' and new.status = 'in_review' and (new.content is distinct from old.content or new.dose is distinct from old.dose) then
    new.status := 'draft'; new.reviewer_id := null; new.approved_at := null;
  end if;

  if new.status is distinct from old.status then
    allowed := (old.status, new.status) in (('draft', 'in_review'), ('in_review', 'draft'), ('in_review', 'published'), ('published', 'retired'));
    if not allowed then raise exception 'Transição não permitida: % -> %', old.status, new.status; end if;

    if new.status = 'in_review' then
      if new.dose is null or new.content->>'name' is null or jsonb_array_length(coalesce(new.content->'stop_if', '[]')) = 0
         or jsonb_array_length(coalesce(new.content->'references', '[]')) = 0 then
        raise exception 'Conteúdo incompleto para revisão';
      end if;
    end if;

    if new.status = 'published' then
      if not public.has_role('content_reviewer') then raise exception 'Apenas revisor pode publicar'; end if;
      select * into r from public.reviewers where user_id = auth.uid();
      if r.user_id is null or r.credential_verified_at is null then raise exception 'Revisor sem credencial verificada'; end if;
      if new.is_demo then raise exception 'Conteúdo de demonstração não pode ser publicado'; end if;
      new.reviewer_id := r.user_id;
      new.approved_at := now();
    end if;
  end if;
  return new;
end $$;

create trigger exercise_versions_flow before insert or update on public.exercise_versions
  for each row execute function public.enforce_editorial_flow();

create or replace function public.log_editorial_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.content_history (exercise_version_id, from_status, to_status, actor) values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.content_history (exercise_version_id, from_status, to_status, actor) values (new.id, old.status, new.status, auth.uid());
  end if;
  return null;
end $$;

create trigger exercise_versions_history after insert or update on public.exercise_versions
  for each row execute function public.log_editorial_history();

alter table public.exercises enable row level security;
alter table public.exercise_versions enable row level security;
alter table public.content_history enable row level security;

create policy exercises_read on public.exercises for select to authenticated using (true);
create policy exercises_editor_write on public.exercises for insert to authenticated with check (public.has_role('content_editor'));

-- Usuários comuns só veem versões publicadas, não-demo, com o módulo clínico ligado no servidor.
create policy versions_public_read on public.exercise_versions for select to authenticated
  using (status = 'published' and not is_demo and public.module_enabled('clinical_content'));
create policy versions_staff_read on public.exercise_versions for select to authenticated
  using (public.has_role('content_editor') or public.has_role('content_reviewer'));
create policy versions_editor_insert on public.exercise_versions for insert to authenticated with check (public.has_role('content_editor'));
create policy versions_staff_update on public.exercise_versions for update to authenticated
  using (public.has_role('content_editor') or public.has_role('content_reviewer'))
  with check (public.has_role('content_editor') or public.has_role('content_reviewer'));
create policy history_staff_read on public.content_history for select to authenticated
  using (public.has_role('content_editor') or public.has_role('content_reviewer'));

-- ---------------------------------------------------------------------------------------------
-- Auditoria (sem áudio, sintomas ou tokens) e exclusão
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null check (action ~ '^[a-z_]{3,48}$'),
  subject_user uuid,
  target text check (target is null or length(target) <= 80),
  at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy audit_subject_read on public.audit_log for select to authenticated using (subject_user = auth.uid());

create or replace function public.audit_professional_read(patient uuid, scope text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.can_view(patient, scope) and patient <> auth.uid() then
    insert into public.audit_log (actor, action, subject_user, target) values (auth.uid(), 'professional_read', patient, scope);
  end if;
end $$;

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  scope text not null check (scope in ('cloud_data', 'account')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Backups do provedor podem reter cópias até o fim da janela de retenção documentada (ver docs/PRIVACIDADE.md).
  backup_purge_expected_by timestamptz
);
alter table public.deletion_requests enable row level security;
create policy deletion_owner on public.deletion_requests for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
