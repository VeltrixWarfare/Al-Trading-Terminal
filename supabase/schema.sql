-- AI Trading Terminal: initial schema
-- Run in a NEW Supabase project's SQL Editor.
-- RLS is enabled. This personal-use baseline binds records to auth.uid().

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.market_quotes (
  id uuid primary key default gen_random_uuid(),
  symbol text not null check (symbol = 'XAUUSD'),
  bid numeric(18,6) not null,
  ask numeric(18,6) not null,
  source text not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ask >= bid)
);

create index if not exists market_quotes_observed_at_idx on public.market_quotes(observed_at desc);

create table if not exists public.market_candles (
  id bigint generated always as identity primary key,
  symbol text not null check (symbol = 'XAUUSD'),
  timeframe text not null check (timeframe in ('M5','M15','H1','H4','D1')),
  candle_time timestamptz not null,
  open numeric(18,6) not null, high numeric(18,6) not null,
  low numeric(18,6) not null, close numeric(18,6) not null,
  source text not null,
  is_closed boolean not null default false,
  unique(symbol,timeframe,candle_time,source),
  check (high >= greatest(open,close,low)),
  check (low <= least(open,close,high))
);

create table if not exists public.market_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null default 'XAUUSD' check (symbol = 'XAUUSD'),
  timeframe text not null,
  data_source text not null,
  data_timestamp timestamptz not null,
  status text not null check (status in ('WAIT','NO TRADE','BUY','SELL')),
  bias text,
  reasoning text not null,
  model_name text,
  model_version text,
  ruleset_version text,
  validation_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.trading_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.market_analysis(id) on delete set null,
  symbol text not null default 'XAUUSD' check (symbol = 'XAUUSD'),
  direction text not null check (direction in ('BUY','SELL')),
  entry_low numeric(18,6) not null,
  entry_high numeric(18,6) not null,
  stop_loss numeric(18,6) not null,
  take_profit_1 numeric(18,6),
  take_profit_2 numeric(18,6),
  take_profit_3 numeric(18,6),
  rr numeric(10,4),
  status text not null default 'SIMULATED' check (status in ('SIMULATED','ACTIVE','INVALIDATED','CLOSED')),
  created_at timestamptz not null default now(),
  check (entry_high >= entry_low)
);

create table if not exists public.signal_updates (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.trading_signals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  note text,
  observed_at timestamptz not null default now()
);

create table if not exists public.trade_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_id uuid references public.trading_signals(id) on delete set null,
  outcome text not null check (outcome in ('WIN','LOSS','BREAKEVEN','UNRESOLVED')),
  realized_r numeric(10,4),
  notes text,
  evaluated_at timestamptz not null default now()
);

create table if not exists public.ai_configurations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Default',
  timeframe_set text[] not null default array['D1','H4','H1','M15','M5'],
  min_rr numeric(10,4) not null default 2.0,
  confidence_threshold numeric(5,2) not null default 70,
  created_at timestamptz not null default now(),
  unique(user_id,name)
);

create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  level text not null check (level in ('INFO','WARN','ERROR')),
  component text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Private user-owned tables
do $$
declare t text;
begin
  foreach t in array array['profiles','market_analysis','trading_signals','signal_updates','trade_journal','ai_configurations','system_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists "profile owner access" on public.profiles;
create policy "profile owner access" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "analysis owner access" on public.market_analysis;
create policy "analysis owner access" on public.market_analysis for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "signals owner access" on public.trading_signals;
create policy "signals owner access" on public.trading_signals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "signal updates owner access" on public.signal_updates;
create policy "signal updates owner access" on public.signal_updates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "journal owner access" on public.trade_journal;
create policy "journal owner access" on public.trade_journal for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "AI config owner access" on public.ai_configurations;
create policy "AI config owner access" on public.ai_configurations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "system logs owner access" on public.system_logs;
create policy "system logs owner access" on public.system_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Market data is read-only to authenticated clients. Writes should be server-side.
alter table public.market_quotes enable row level security;
alter table public.market_candles enable row level security;
drop policy if exists "authenticated read quotes" on public.market_quotes;
create policy "authenticated read quotes" on public.market_quotes for select to authenticated using (true);
drop policy if exists "authenticated read candles" on public.market_candles;
create policy "authenticated read candles" on public.market_candles for select to authenticated using (true);

-- Automatically create a profile for each new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
