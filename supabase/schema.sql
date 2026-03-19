create extension if not exists "pgcrypto";

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.supplies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purchase_price numeric(12,2) not null default 0,
  quantity_in_package numeric(12,2) not null default 1,
  unit_label text not null default 'un',
  cost_per_unit numeric(12,4) not null default 0,
  stock_quantity numeric(12,2) not null default 0,
  low_stock_threshold numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.procedure_supplies (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  supply_id uuid not null references public.supplies(id) on delete restrict,
  quantity_used numeric(12,2) not null default 0
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  attended_at timestamptz not null,
  payment_method text,
  discount numeric(12,2) not null default 0,
  gross_amount numeric(12,2) not null default 0,
  cost_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.appointment_procedures (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete restrict,
  price_charged numeric(12,2) not null default 0
);

create table if not exists public.appointment_supplies (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  supply_id uuid not null references public.supplies(id) on delete restrict,
  quantity_used numeric(12,2) not null default 0,
  unit_cost numeric(12,4) not null default 0,
  total_cost numeric(12,2) not null default 0
);

create table if not exists public.settings (
  id uuid primary key,
  salon_name text not null default 'ESPAÇO ANA ARESSA',
  inactive_days_threshold int not null default 30,
  whatsapp_message_template text not null default 'Oi {nome}, tudo bem? 😊

Aqui é do ESPAÇO ANA ARESSA.
Vi que seu último atendimento foi {procedimento} e já faz um tempinho.

Vamos agendar seu próximo horário? 💅✨',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.settings (id, salon_name, inactive_days_threshold)
values ('00000000-0000-0000-0000-000000000001', 'ESPAÇO ANA ARESSA', 30)
on conflict (id) do nothing;

alter table public.clients enable row level security;
alter table public.supplies enable row level security;
alter table public.procedures enable row level security;
alter table public.procedure_supplies enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_procedures enable row level security;
alter table public.appointment_supplies enable row level security;
alter table public.settings enable row level security;

drop policy if exists "all clients" on public.clients;
create policy "all clients" on public.clients for all using (true) with check (true);
drop policy if exists "all supplies" on public.supplies;
create policy "all supplies" on public.supplies for all using (true) with check (true);
drop policy if exists "all procedures" on public.procedures;
create policy "all procedures" on public.procedures for all using (true) with check (true);
drop policy if exists "all procedure supplies" on public.procedure_supplies;
create policy "all procedure supplies" on public.procedure_supplies for all using (true) with check (true);
drop policy if exists "all appointments" on public.appointments;
create policy "all appointments" on public.appointments for all using (true) with check (true);
drop policy if exists "all appointment procedures" on public.appointment_procedures;
create policy "all appointment procedures" on public.appointment_procedures for all using (true) with check (true);
drop policy if exists "all appointment supplies" on public.appointment_supplies;
create policy "all appointment supplies" on public.appointment_supplies for all using (true) with check (true);
drop policy if exists "all settings" on public.settings;
create policy "all settings" on public.settings for all using (true) with check (true);
