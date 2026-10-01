-- PumpStock schema for a fresh Supabase project.
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: tables use IF NOT EXISTS; policies are dropped and recreated.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id text primary key,
  name text not null,
  role text not null check (role in ('admin', 'owner', 'manager', 'operator')),
  phone text,
  email text,
  photo_url text,
  address text,
  is_active boolean not null default true,
  staff_pay_mode text check (staff_pay_mode is null or staff_pay_mode in ('per_shift', 'monthly')),
  shift_pay_rate_inr numeric,
  monthly_salary_inr numeric,
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_types (
  id text primary key,
  name text not null,
  current_rate numeric not null,
  last_updated_at timestamptz not null default now(),
  tank_capacity_liters numeric,
  reserve_liters numeric,
  current_stock_liters numeric,
  last_dip_cm numeric,
  last_dip_at timestamptz
);

create table if not exists public.nozzles (
  id text primary key,
  machine_number text not null,
  nozzle_number text not null,
  fuel_type_id text not null,
  is_active boolean not null default true
);

create table if not exists public.shifts (
  id text primary key,
  operator_id text not null,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  shift_label text not null,
  status text not null check (status in ('open', 'closed')),
  readings_complete_at timestamptz,
  notes text,
  pump_attendants text,
  attendant_posts jsonb,
  calendar_date text
);

create table if not exists public.shift_readings (
  id text primary key,
  shift_id text not null,
  nozzle_id text not null,
  opening_reading numeric not null,
  closing_reading numeric not null,
  test_liters numeric not null default 0,
  total_liters numeric not null default 0,
  final_sales_liters numeric not null default 0,
  rate_at_sale numeric not null default 0,
  total_amount numeric not null default 0
);

create table if not exists public.shift_reconciliations (
  id text primary key,
  shift_id text not null,
  operator_id text not null,
  total_sales_amount numeric not null,
  paytm_online numeric not null default 0,
  icici_card numeric not null default 0,
  fleet_card numeric not null default 0,
  credit_amount numeric not null default 0,
  short_amount numeric not null default 0,
  cash_amount numeric not null default 0,
  total_received numeric not null default 0,
  difference numeric not null default 0,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  manager_comment text,
  locked boolean not null default false,
  credit_line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_customers (
  id text primary key,
  name text not null,
  contact_person text,
  phone text,
  vehicle_number text,
  is_active boolean not null default true,
  current_balance numeric not null default 0
);

create table if not exists public.credit_sales (
  id text primary key,
  customer_id text not null,
  shift_id text not null,
  date timestamptz not null,
  amount numeric not null,
  fuel_type_id text,
  liters numeric,
  rate_at_sale numeric,
  reference text
);

create table if not exists public.credit_payments (
  id text primary key,
  customer_id text not null,
  date timestamptz not null,
  amount_received numeric not null,
  mode text not null,
  notes text
);

create table if not exists public.ledger_entries (
  id text primary key,
  date timestamptz not null,
  type text not null check (type in ('expense', 'income')),
  payment_channel text,
  paid_to_or_received_from text not null default '',
  particulars text not null default '',
  category text not null default '',
  amount numeric not null,
  related_credit_payment_id text,
  related_loan_id text,
  related_loan_repayment_id text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fuel_tank_dips (
  id text primary key,
  fuel_type_id text not null,
  dip_cm numeric not null,
  dip_liters numeric not null,
  pump_day_iso text not null,
  dip_kind text not null check (dip_kind in ('opening', 'closing')),
  recorded_at timestamptz not null default now(),
  recorded_by text,
  notes text
);

create table if not exists public.fuel_receipts (
  id text primary key,
  fuel_type_id text not null,
  pump_day_iso text not null,
  liters numeric not null,
  rate_per_kl numeric,
  material_code text,
  supplier text,
  invoice_no text,
  recorded_by text,
  notes text,
  recorded_at timestamptz not null default now()
);

create table if not exists public.fuel_dip_ledger (
  id text primary key,
  fuel_type_id text not null,
  pump_day_iso text not null,
  opening_stock_liters numeric not null,
  receipt_liters numeric not null,
  total_stock_liters numeric not null,
  sales_liters numeric not null,
  closing_book_liters numeric not null,
  variation_liters numeric,
  updated_at timestamptz not null default now(),
  updated_by text,
  unique (pump_day_iso, fuel_type_id)
);

create table if not exists public.lubricants (
  id text primary key,
  name text not null,
  brand text not null default '',
  grade text not null default '',
  unit text not null default 'litre',
  selling_price numeric not null default 0,
  purchase_price numeric not null default 0,
  current_stock numeric not null default 0,
  min_stock_alert numeric not null default 0,
  is_active boolean not null default true
);

create table if not exists public.lubricant_stock_entries (
  id text primary key,
  lubricant_id text not null,
  pump_day_iso text not null,
  quantity numeric not null,
  purchase_price_per_unit numeric not null,
  supplier text,
  invoice_no text,
  notes text,
  recorded_by text,
  recorded_at timestamptz not null default now()
);

create table if not exists public.lubricant_sales (
  id text primary key,
  lubricant_id text not null,
  pump_day_iso text not null,
  quantity numeric not null,
  selling_price_per_unit numeric not null,
  total_amount numeric not null,
  customer_name text,
  vehicle_number text,
  notes text,
  recorded_by text,
  recorded_at timestamptz not null default now()
);

create table if not exists public.station_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists shifts_operator_status_idx on public.shifts (operator_id, status);
create index if not exists shifts_status_end_time_idx on public.shifts (status, end_time);
create index if not exists shifts_start_time_idx on public.shifts (start_time);
create index if not exists shifts_calendar_date_idx on public.shifts (calendar_date);
create index if not exists shift_readings_shift_idx on public.shift_readings (shift_id);
create index if not exists shift_readings_nozzle_idx on public.shift_readings (nozzle_id);
create index if not exists shift_recon_shift_idx on public.shift_reconciliations (shift_id);
create index if not exists shift_recon_status_idx on public.shift_reconciliations (status);
create index if not exists credit_sales_customer_idx on public.credit_sales (customer_id);
create index if not exists credit_sales_shift_idx on public.credit_sales (shift_id);
create index if not exists credit_payments_customer_idx on public.credit_payments (customer_id);
create index if not exists credit_payments_date_idx on public.credit_payments (date);
create index if not exists ledger_entries_date_idx on public.ledger_entries (date);
create index if not exists fuel_tank_dips_fuel_recorded_idx on public.fuel_tank_dips (fuel_type_id, recorded_at desc);
create index if not exists fuel_receipts_day_idx on public.fuel_receipts (pump_day_iso);
create index if not exists fuel_receipts_fuel_day_idx on public.fuel_receipts (fuel_type_id, pump_day_iso);
create index if not exists fuel_dip_ledger_day_idx on public.fuel_dip_ledger (pump_day_iso);
create index if not exists lubricant_stock_lube_recorded_idx on public.lubricant_stock_entries (lubricant_id, recorded_at desc);
create index if not exists lubricant_sales_day_idx on public.lubricant_sales (pump_day_iso);

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so policies do not recurse through RLS)
-- ---------------------------------------------------------------------------

create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()::text;
$$;

create or replace function public.app_is_signed_in()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null;
$$;

create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_role() = 'admin';
$$;

create or replace function public.app_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_role() = 'owner';
$$;

create or replace function public.app_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_role() = 'manager';
$$;

create or replace function public.app_is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_role() = 'operator';
$$;

create or replace function public.app_is_ops_reader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_role() in ('admin', 'owner', 'manager');
$$;

create or replace function public.app_is_ops_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_role() in ('admin', 'manager');
$$;

create or replace function public.app_shift_operator(p_shift_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select operator_id from public.shifts where id = p_shift_id;
$$;

-- Operators may update only stock / dip / rate columns on fuel_types.
create or replace function public.guard_fuel_type_operator_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.app_is_ops_writer() then
    return new;
  end if;
  if public.app_is_operator() then
    if new.name is distinct from old.name
      or new.tank_capacity_liters is distinct from old.tank_capacity_liters
      or new.reserve_liters is distinct from old.reserve_liters
    then
      raise exception 'Operators may only update stock and rate fields';
    end if;
    return new;
  end if;
  raise exception 'Not allowed to update fuel types';
end;
$$;

drop trigger if exists fuel_types_operator_guard on public.fuel_types;
create trigger fuel_types_operator_guard
  before update on public.fuel_types
  for each row
  execute function public.guard_fuel_type_operator_update();

-- ---------------------------------------------------------------------------
-- Transactions the client used to split across several Firestore writes
-- ---------------------------------------------------------------------------

create or replace function public.create_reconciliation_with_close(payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  role text := public.app_role();
  shift_operator text;
  new_id text := gen_random_uuid()::text;
  line jsonb;
  amt numeric;
  cid text;
  sale_at timestamptz;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select operator_id into shift_operator from public.shifts where id = payload->>'shiftId';
  if shift_operator is null then
    raise exception 'Shift not found';
  end if;

  if role not in ('admin', 'manager')
    and not (role = 'operator' and shift_operator = uid and payload->>'operatorId' = uid)
  then
    raise exception 'Not allowed to close this shift';
  end if;

  sale_at := coalesce((payload->>'saleDate')::timestamptz, now());

  insert into public.shift_reconciliations (
    id, shift_id, operator_id, total_sales_amount, paytm_online, icici_card, fleet_card,
    credit_amount, short_amount, cash_amount, total_received, difference,
    status, locked, credit_line_items, created_at, updated_at
  ) values (
    new_id,
    payload->>'shiftId',
    payload->>'operatorId',
    coalesce((payload->>'totalSalesAmount')::numeric, 0),
    coalesce((payload->>'paytmOnline')::numeric, 0),
    coalesce((payload->>'iciciCard')::numeric, 0),
    coalesce((payload->>'fleetCard')::numeric, 0),
    coalesce((payload->>'creditAmount')::numeric, 0),
    coalesce((payload->>'shortAmount')::numeric, 0),
    coalesce((payload->>'cashAmount')::numeric, 0),
    coalesce((payload->>'totalReceived')::numeric, 0),
    coalesce((payload->>'difference')::numeric, 0),
    'pending',
    false,
    coalesce(payload->'creditLineItems', '[]'::jsonb),
    now(),
    now()
  );

  for line in
    select value from jsonb_array_elements(coalesce(payload->'creditLineItems', '[]'::jsonb))
  loop
    amt := round(coalesce((line->>'amount')::numeric, 0), 2);
    if amt <= 0 then
      continue;
    end if;
    cid := line->>'customerId';
    insert into public.credit_sales (
      id, customer_id, shift_id, date, amount, fuel_type_id, liters, rate_at_sale, reference
    ) values (
      gen_random_uuid()::text,
      cid,
      payload->>'shiftId',
      sale_at,
      amt,
      nullif(line->>'fuelTypeId', ''),
      case
        when coalesce(line->>'liters', '') <> '' then (line->>'liters')::numeric
        else null
      end,
      case
        when coalesce(line->>'rateAtSale', '') <> '' then round((line->>'rateAtSale')::numeric, 2)
        else null
      end,
      'SHIFT_RECON:' || (payload->>'shiftId')
    );
    update public.credit_customers
      set current_balance = current_balance + amt
      where id = cid;
  end loop;

  update public.shifts
    set status = 'closed', end_time = now()
    where id = payload->>'shiftId';

  return new_id;
end;
$$;

create or replace function public.replace_shift_credit_sales(
  p_shift_id text,
  p_lines jsonb,
  p_sale_date timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  role text := public.app_role();
  shift_operator text;
  rec record;
  line jsonb;
  amt numeric;
  cid text;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select operator_id into shift_operator from public.shifts where id = p_shift_id;
  if shift_operator is null then
    raise exception 'Shift not found';
  end if;

  if role not in ('admin', 'manager')
    and not (role = 'operator' and shift_operator = uid)
  then
    raise exception 'Not allowed to replace credit sales for this shift';
  end if;

  for rec in
    select id, customer_id, amount
    from public.credit_sales
    where shift_id = p_shift_id
      and coalesce(reference, '') like 'SHIFT_RECON:%'
  loop
    if rec.customer_id is not null and rec.amount > 0 then
      update public.credit_customers
        set current_balance = current_balance - rec.amount
        where id = rec.customer_id;
    end if;
    delete from public.credit_sales where id = rec.id;
  end loop;

  for line in
    select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    amt := round(coalesce((line->>'amount')::numeric, 0), 2);
    if amt <= 0 then
      continue;
    end if;
    cid := line->>'customerId';
    insert into public.credit_sales (
      id, customer_id, shift_id, date, amount, fuel_type_id, liters, rate_at_sale, reference
    ) values (
      gen_random_uuid()::text,
      cid,
      p_shift_id,
      coalesce(p_sale_date, now()),
      amt,
      nullif(line->>'fuelTypeId', ''),
      case
        when coalesce(line->>'liters', '') <> '' then (line->>'liters')::numeric
        else null
      end,
      case
        when coalesce(line->>'rateAtSale', '') <> '' then round((line->>'rateAtSale')::numeric, 2)
        else null
      end,
      'SHIFT_RECON:' || p_shift_id
    );
    update public.credit_customers
      set current_balance = current_balance + amt
      where id = cid;
  end loop;
end;
$$;

create or replace function public.update_shift_readings(updates jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  row jsonb;
  updated_count integer;
begin
  for row in select value from jsonb_array_elements(coalesce(updates, '[]'::jsonb))
  loop
    update public.shift_readings set
      opening_reading = coalesce((row->>'openingReading')::numeric, opening_reading),
      closing_reading = coalesce((row->>'closingReading')::numeric, closing_reading),
      test_liters = coalesce((row->>'testLiters')::numeric, test_liters),
      total_liters = coalesce((row->>'totalLiters')::numeric, total_liters),
      final_sales_liters = coalesce((row->>'finalSalesLiters')::numeric, final_sales_liters),
      rate_at_sale = coalesce((row->>'rateAtSale')::numeric, rate_at_sale),
      total_amount = coalesce((row->>'totalAmount')::numeric, total_amount)
    where id = row->>'id';
    get diagnostics updated_count = row_count;
    if updated_count = 0 then
      raise exception 'Could not update shift reading %', row->>'id';
    end if;
  end loop;
end;
$$;

revoke all on function public.create_reconciliation_with_close(jsonb) from public;
revoke all on function public.replace_shift_credit_sales(text, jsonb, timestamptz) from public;
revoke all on function public.update_shift_readings(jsonb) from public;
grant execute on function public.create_reconciliation_with_close(jsonb) to authenticated;
grant execute on function public.replace_shift_credit_sales(text, jsonb, timestamptz) to authenticated;
grant execute on function public.update_shift_readings(jsonb) to authenticated;

grant execute on function public.app_role() to anon, authenticated;
grant execute on function public.app_is_signed_in() to anon, authenticated;
grant execute on function public.app_is_admin() to anon, authenticated;
grant execute on function public.app_is_owner() to anon, authenticated;
grant execute on function public.app_is_manager() to anon, authenticated;
grant execute on function public.app_is_operator() to anon, authenticated;
grant execute on function public.app_is_ops_reader() to anon, authenticated;
grant execute on function public.app_is_ops_writer() to anon, authenticated;
grant execute on function public.app_shift_operator(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.fuel_types enable row level security;
alter table public.nozzles enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_readings enable row level security;
alter table public.shift_reconciliations enable row level security;
alter table public.credit_customers enable row level security;
alter table public.credit_sales enable row level security;
alter table public.credit_payments enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.fuel_tank_dips enable row level security;
alter table public.fuel_receipts enable row level security;
alter table public.fuel_dip_ledger enable row level security;
alter table public.lubricants enable row level security;
alter table public.lubricant_stock_entries enable row level security;
alter table public.lubricant_sales enable row level security;
alter table public.station_settings enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.app_is_signed_in());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.app_is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.app_is_admin());

-- fuel_types (operator column limits enforced by trigger)
drop policy if exists fuel_types_select on public.fuel_types;
create policy fuel_types_select on public.fuel_types
  for select to authenticated
  using (public.app_is_signed_in());

drop policy if exists fuel_types_insert on public.fuel_types;
create policy fuel_types_insert on public.fuel_types
  for insert to authenticated
  with check (public.app_is_ops_writer());

drop policy if exists fuel_types_update on public.fuel_types;
create policy fuel_types_update on public.fuel_types
  for update to authenticated
  using (public.app_is_ops_writer() or public.app_is_operator())
  with check (public.app_is_ops_writer() or public.app_is_operator());

drop policy if exists fuel_types_delete on public.fuel_types;
create policy fuel_types_delete on public.fuel_types
  for delete to authenticated
  using (public.app_is_ops_writer());

-- nozzles
drop policy if exists nozzles_select on public.nozzles;
create policy nozzles_select on public.nozzles
  for select to authenticated
  using (public.app_is_signed_in());

drop policy if exists nozzles_write on public.nozzles;
create policy nozzles_write on public.nozzles
  for all to authenticated
  using (public.app_is_ops_writer())
  with check (public.app_is_ops_writer());

-- shifts
drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts
  for select to authenticated
  using (
    public.app_is_ops_reader()
    or operator_id = auth.uid()::text
  );

drop policy if exists shifts_insert on public.shifts;
create policy shifts_insert on public.shifts
  for insert to authenticated
  with check (
    status in ('open', 'closed')
    and (
      public.app_is_ops_writer()
      or (public.app_is_operator() and operator_id = auth.uid()::text)
    )
  );

drop policy if exists shifts_update on public.shifts;
create policy shifts_update on public.shifts
  for update to authenticated
  using (
    public.app_is_ops_writer()
    or (public.app_is_operator() and operator_id = auth.uid()::text)
  )
  with check (
    public.app_is_ops_writer()
    or (public.app_is_operator() and operator_id = auth.uid()::text)
  );

drop policy if exists shifts_delete on public.shifts;
create policy shifts_delete on public.shifts
  for delete to authenticated
  using (
    public.app_is_ops_writer()
    or (public.app_is_operator() and operator_id = auth.uid()::text)
  );

-- shift_readings
drop policy if exists shift_readings_select on public.shift_readings;
create policy shift_readings_select on public.shift_readings
  for select to authenticated
  using (
    public.app_is_ops_reader()
    or (public.app_is_operator() and public.app_shift_operator(shift_id) = auth.uid()::text)
  );

drop policy if exists shift_readings_insert on public.shift_readings;
create policy shift_readings_insert on public.shift_readings
  for insert to authenticated
  with check (
    public.app_is_ops_writer()
    or (public.app_is_operator() and public.app_shift_operator(shift_id) = auth.uid()::text)
  );

drop policy if exists shift_readings_update on public.shift_readings;
create policy shift_readings_update on public.shift_readings
  for update to authenticated
  using (
    public.app_is_ops_writer()
    or (public.app_is_operator() and public.app_shift_operator(shift_id) = auth.uid()::text)
  )
  with check (
    public.app_is_ops_writer()
    or (public.app_is_operator() and public.app_shift_operator(shift_id) = auth.uid()::text)
  );

drop policy if exists shift_readings_delete on public.shift_readings;
create policy shift_readings_delete on public.shift_readings
  for delete to authenticated
  using (
    public.app_is_ops_writer()
    or (public.app_is_operator() and public.app_shift_operator(shift_id) = auth.uid()::text)
  );

-- shift_reconciliations
-- Operators may edit only while the existing row is still pending, and cannot approve themselves.
drop policy if exists shift_recon_select on public.shift_reconciliations;
create policy shift_recon_select on public.shift_reconciliations
  for select to authenticated
  using (
    public.app_is_ops_reader()
    or operator_id = auth.uid()::text
  );

drop policy if exists shift_recon_insert on public.shift_reconciliations;
create policy shift_recon_insert on public.shift_reconciliations
  for insert to authenticated
  with check (
    public.app_is_ops_writer()
    or (public.app_is_operator() and operator_id = auth.uid()::text)
  );

drop policy if exists shift_recon_update on public.shift_reconciliations;
create policy shift_recon_update on public.shift_reconciliations
  for update to authenticated
  using (
    public.app_is_ops_writer()
    or (
      public.app_is_operator()
      and operator_id = auth.uid()::text
      and status = 'pending'
    )
  )
  with check (
    public.app_is_ops_writer()
    or (
      public.app_is_operator()
      and operator_id = auth.uid()::text
      and status = 'pending'
    )
  );

drop policy if exists shift_recon_delete on public.shift_reconciliations;
create policy shift_recon_delete on public.shift_reconciliations
  for delete to authenticated
  using (
    public.app_is_ops_writer()
    or (
      public.app_is_operator()
      and operator_id = auth.uid()::text
      and status = 'pending'
    )
  );

-- credit customers / payments / ledger / lubricants: owner reads, manager and admin write
drop policy if exists credit_customers_select on public.credit_customers;
create policy credit_customers_select on public.credit_customers
  for select to authenticated
  using (public.app_is_ops_reader());

drop policy if exists credit_customers_write on public.credit_customers;
create policy credit_customers_write on public.credit_customers
  for all to authenticated
  using (public.app_is_ops_writer())
  with check (public.app_is_ops_writer());

drop policy if exists credit_sales_select on public.credit_sales;
create policy credit_sales_select on public.credit_sales
  for select to authenticated
  using (
    public.app_is_ops_reader()
    or (public.app_is_operator() and public.app_shift_operator(shift_id) = auth.uid()::text)
  );

drop policy if exists credit_sales_insert on public.credit_sales;
create policy credit_sales_insert on public.credit_sales
  for insert to authenticated
  with check (
    customer_id is not null
    and shift_id is not null
    and date is not null
    and amount is not null
    and (
      public.app_is_ops_writer()
      or (public.app_is_operator() and public.app_shift_operator(shift_id) = auth.uid()::text)
    )
  );

drop policy if exists credit_sales_update on public.credit_sales;
create policy credit_sales_update on public.credit_sales
  for update to authenticated
  using (public.app_is_ops_writer())
  with check (public.app_is_ops_writer());

drop policy if exists credit_sales_delete on public.credit_sales;
create policy credit_sales_delete on public.credit_sales
  for delete to authenticated
  using (public.app_is_ops_writer());

drop policy if exists credit_payments_select on public.credit_payments;
create policy credit_payments_select on public.credit_payments
  for select to authenticated
  using (public.app_is_ops_reader());

drop policy if exists credit_payments_write on public.credit_payments;
create policy credit_payments_write on public.credit_payments
  for all to authenticated
  using (public.app_is_ops_writer())
  with check (public.app_is_ops_writer());

drop policy if exists ledger_entries_select on public.ledger_entries;
create policy ledger_entries_select on public.ledger_entries
  for select to authenticated
  using (public.app_is_ops_reader());

drop policy if exists ledger_entries_write on public.ledger_entries;
create policy ledger_entries_write on public.ledger_entries
  for all to authenticated
  using (public.app_is_ops_writer())
  with check (public.app_is_ops_writer());

drop policy if exists lubricants_select on public.lubricants;
create policy lubricants_select on public.lubricants
  for select to authenticated
  using (public.app_is_ops_reader());

drop policy if exists lubricants_write on public.lubricants;
create policy lubricants_write on public.lubricants
  for all to authenticated
  using (public.app_is_ops_writer())
  with check (public.app_is_ops_writer());

drop policy if exists lubricant_stock_select on public.lubricant_stock_entries;
create policy lubricant_stock_select on public.lubricant_stock_entries
  for select to authenticated
  using (public.app_is_ops_reader());

drop policy if exists lubricant_stock_write on public.lubricant_stock_entries;
create policy lubricant_stock_write on public.lubricant_stock_entries
  for all to authenticated
  using (public.app_is_ops_writer())
  with check (public.app_is_ops_writer());

drop policy if exists lubricant_sales_select on public.lubricant_sales;
create policy lubricant_sales_select on public.lubricant_sales
  for select to authenticated
  using (public.app_is_ops_reader());

drop policy if exists lubricant_sales_write on public.lubricant_sales;
create policy lubricant_sales_write on public.lubricant_sales
  for all to authenticated
  using (public.app_is_ops_writer())
  with check (public.app_is_ops_writer());

-- dips, receipts, dip ledger: any signed-in user can read; operators may write; only ops delete
drop policy if exists fuel_dips_select on public.fuel_tank_dips;
create policy fuel_dips_select on public.fuel_tank_dips
  for select to authenticated
  using (public.app_is_signed_in());

drop policy if exists fuel_dips_insert on public.fuel_tank_dips;
create policy fuel_dips_insert on public.fuel_tank_dips
  for insert to authenticated
  with check (public.app_is_ops_writer() or public.app_is_operator());

drop policy if exists fuel_dips_update on public.fuel_tank_dips;
create policy fuel_dips_update on public.fuel_tank_dips
  for update to authenticated
  using (public.app_is_ops_writer() or public.app_is_operator())
  with check (public.app_is_ops_writer() or public.app_is_operator());

drop policy if exists fuel_dips_delete on public.fuel_tank_dips;
create policy fuel_dips_delete on public.fuel_tank_dips
  for delete to authenticated
  using (public.app_is_ops_writer());

drop policy if exists fuel_receipts_select on public.fuel_receipts;
create policy fuel_receipts_select on public.fuel_receipts
  for select to authenticated
  using (public.app_is_signed_in());

drop policy if exists fuel_receipts_insert on public.fuel_receipts;
create policy fuel_receipts_insert on public.fuel_receipts
  for insert to authenticated
  with check (public.app_is_ops_writer() or public.app_is_operator());

drop policy if exists fuel_receipts_update on public.fuel_receipts;
create policy fuel_receipts_update on public.fuel_receipts
  for update to authenticated
  using (public.app_is_ops_writer() or public.app_is_operator())
  with check (public.app_is_ops_writer() or public.app_is_operator());

drop policy if exists fuel_receipts_delete on public.fuel_receipts;
create policy fuel_receipts_delete on public.fuel_receipts
  for delete to authenticated
  using (public.app_is_ops_writer());

drop policy if exists fuel_dip_ledger_select on public.fuel_dip_ledger;
create policy fuel_dip_ledger_select on public.fuel_dip_ledger
  for select to authenticated
  using (public.app_is_signed_in());

drop policy if exists fuel_dip_ledger_insert on public.fuel_dip_ledger;
create policy fuel_dip_ledger_insert on public.fuel_dip_ledger
  for insert to authenticated
  with check (public.app_is_ops_writer() or public.app_is_operator());

drop policy if exists fuel_dip_ledger_update on public.fuel_dip_ledger;
create policy fuel_dip_ledger_update on public.fuel_dip_ledger
  for update to authenticated
  using (public.app_is_ops_writer() or public.app_is_operator())
  with check (public.app_is_ops_writer() or public.app_is_operator());

drop policy if exists fuel_dip_ledger_delete on public.fuel_dip_ledger;
create policy fuel_dip_ledger_delete on public.fuel_dip_ledger
  for delete to authenticated
  using (public.app_is_ops_writer());

-- station settings: about page is public; other docs need a sign-in; only admin writes
drop policy if exists station_settings_select on public.station_settings;
create policy station_settings_select on public.station_settings
  for select to anon, authenticated
  using (id = 'about' or auth.uid() is not null);

drop policy if exists station_settings_insert on public.station_settings;
create policy station_settings_insert on public.station_settings
  for insert to authenticated
  with check (public.app_is_admin());

drop policy if exists station_settings_update on public.station_settings;
create policy station_settings_update on public.station_settings
  for update to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

drop policy if exists station_settings_delete on public.station_settings;
create policy station_settings_delete on public.station_settings
  for delete to authenticated
  using (public.app_is_admin());

grant select on public.station_settings to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Staff photos (private bucket; signed-in staff can read, admin uploads)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('staff-photos', 'staff-photos', false)
on conflict (id) do update set public = false;

drop policy if exists staff_photos_read on storage.objects;
create policy staff_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'staff-photos');

drop policy if exists staff_photos_insert on storage.objects;
create policy staff_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'staff-photos' and public.app_is_admin());

drop policy if exists staff_photos_update on storage.objects;
create policy staff_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'staff-photos' and public.app_is_admin())
  with check (bucket_id = 'staff-photos' and public.app_is_admin());

drop policy if exists staff_photos_delete on storage.objects;
create policy staff_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'staff-photos' and public.app_is_admin());
