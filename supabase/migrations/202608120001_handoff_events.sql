create table public.handoff_events (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  handoff_id uuid not null,
  status text not null check (status in ('REQUIRED','NOTIFICATION_PENDING','NOTIFIED','NOTIFICATION_FAILED','TAKEN_OVER','RESOLVED')),
  reason text,
  commercial_stage text,
  provider text,
  notification_id text,
  error_code text,
  created_at timestamptz not null default now()
);

create index handoff_events_phone_created_at_idx on public.handoff_events (phone, created_at desc);
create index handoff_events_handoff_id_idx on public.handoff_events (handoff_id);

alter table public.handoff_events enable row level security;
revoke all on table public.handoff_events from anon, authenticated;
grant select, insert on table public.handoff_events to service_role;
