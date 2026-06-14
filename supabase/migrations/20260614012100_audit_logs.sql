create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid null references public.profiles(id) on delete set null,
  action text not null check (length(btrim(action)) > 0),
  entity_type text not null check (length(btrim(entity_type)) > 0),
  entity_id uuid null,
  before_data jsonb null,
  after_data jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create or replace function public.reject_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

create trigger audit_logs_reject_update
before update on public.audit_logs
for each row execute function public.reject_audit_log_mutation();

create trigger audit_logs_reject_delete
before delete on public.audit_logs
for each row execute function public.reject_audit_log_mutation();

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_action_idx on public.audit_logs (action);

comment on table public.audit_logs is 'Append-only audit event table. Default audit exports must exclude sensitive JSON fields.';
comment on column public.audit_logs.before_data is 'Optional sensitive before snapshot. Exclude from default audit exports.';
comment on column public.audit_logs.after_data is 'Optional sensitive after snapshot. Exclude from default audit exports.';
