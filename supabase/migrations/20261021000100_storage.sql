-- Storage privado para trechos de áudio que o USUÁRIO escolher enviar (ex.: para um profissional).
-- Noites completas não são enviadas por padrão. Acesso por links temporários (signed URLs).
insert into storage.buckets (id, name, public) values ('session-clips', 'session-clips', false)
on conflict (id) do nothing;

-- Caminho obrigatório: <user_id>/<arquivo>
create policy clips_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'session-clips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy clips_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'session-clips' and (storage.foldername(name))[1] = auth.uid()::text
    and public.module_enabled('cloud_sync') and public.has_consent(auth.uid(), 'cloud_sync')
  );
create policy clips_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'session-clips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy clips_professional_read on storage.objects for select to authenticated
  using (bucket_id = 'session-clips' and public.can_view(((storage.foldername(name))[1])::uuid, 'sessions'));
