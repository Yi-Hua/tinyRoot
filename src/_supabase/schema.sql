-- =============================================================
-- Tiny Root v2.0 Schema (整合版)
-- 在 Supabase SQL Editor 開新分頁,整段貼上,Run 一次即可。
-- =============================================================

-- 確保 uuid extension 開著
create extension if not exists "uuid-ossp";

-- 砍掉舊的(若有),從乾淨狀態重建
drop trigger  if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

drop table if exists transactions cascade;
drop table if exists budgets       cascade;
drop table if exists categories    cascade;
drop table if exists accounts      cascade;
drop table if exists ledger_users  cascade;
drop table if exists ledgers       cascade;
drop table if exists profiles      cascade;

-- ============================================================
-- 1. profiles  (會員資料,跟 auth.users 一對一)
-- ============================================================
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- ============================================================
-- 2. ledgers  (帳本:個人 / 共享)
-- ============================================================
create table ledgers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text not null check (type in ('personal','shared')),
  owner_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

-- ============================================================
-- 3. ledger_users  (帳本成員,多對多)
-- ============================================================
create table ledger_users (
  id uuid default uuid_generate_v4() primary key,
  ledger_id uuid references ledgers(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  role text default 'member',
  joined_at timestamptz default now() not null,
  unique(ledger_id, profile_id)
);

-- ============================================================
-- 4. accounts  (錢包/銀行帳戶/信用卡)
-- ============================================================
create table accounts (
  id uuid default uuid_generate_v4() primary key,
  ledger_id uuid references ledgers(id) on delete cascade not null,
  name text not null,
  type text not null,                     -- 'cash' | 'bank' | 'credit_card' | 'ewallet'
  balance numeric default 0,
  created_at timestamptz default now() not null
);

-- ============================================================
-- 5. categories
-- ============================================================
create table categories (
  id uuid default uuid_generate_v4() primary key,
  ledger_id uuid references ledgers(id) on delete cascade not null,
  name text not null,
  icon text,
  type text not null check (type in ('expense','income')),
  created_at timestamptz default now() not null
);

-- ============================================================
-- 6. transactions  (一筆記帳)
--    新增欄位:source / invoice_num / spender (給載具發票去重 + 共享帳本標記誰付的錢)
-- ============================================================
create table transactions (
  id uuid default uuid_generate_v4() primary key,
  ledger_id uuid references ledgers(id) on delete cascade not null,
  account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  profile_id uuid references profiles(id) on delete set null,
  amount numeric not null,
  description text,
  date date not null default current_date,
  type text not null check (type in ('expense','income')),
  source text default 'manual',           -- 'manual' | 'invoice'
  invoice_num text,                       -- 載具發票號碼 (匯入去重)
  spender text,                           -- 自由文字,例如「爸爸」「媽媽」
  created_at timestamptz default now() not null
);
create index idx_tx_ledger_inv  on transactions(ledger_id, invoice_num);
create index idx_tx_ledger_date on transactions(ledger_id, date desc);

-- ============================================================
-- 7. budgets
-- ============================================================
create table budgets (
  id uuid default uuid_generate_v4() primary key,
  ledger_id uuid references ledgers(id) on delete cascade not null,
  category_id uuid references categories(id) on delete cascade,
  name text not null,
  limit_amount numeric not null,
  period text not null,                   -- 'monthly' | 'yearly' | 'custom'
  start_date date,
  end_date date,
  created_at timestamptz default now() not null
);

-- =============================================================
-- RLS:全部開啟,並設定「只能存取自己參與的帳本」
-- =============================================================

alter table profiles      enable row level security;
alter table ledgers       enable row level security;
alter table ledger_users  enable row level security;
alter table accounts      enable row level security;
alter table categories    enable row level security;
alter table transactions  enable row level security;
alter table budgets       enable row level security;

-- profiles
create policy "profiles_self_select"
  on profiles for select using (id = auth.uid());
create policy "profiles_self_insert"
  on profiles for insert with check (id = auth.uid());
create policy "profiles_self_update"
  on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ledger_users
create policy "lu_self_select"
  on ledger_users for select using (profile_id = auth.uid());
create policy "lu_self_insert"
  on ledger_users for insert with check (profile_id = auth.uid());
create policy "lu_self_delete"
  on ledger_users for delete using (profile_id = auth.uid());

-- ledgers
create policy "ledgers_member_select"
  on ledgers for select using (
    exists(select 1 from ledger_users lu
           where lu.ledger_id = ledgers.id and lu.profile_id = auth.uid())
  );
create policy "ledgers_owner_insert"
  on ledgers for insert with check (owner_id = auth.uid());
create policy "ledgers_owner_update"
  on ledgers for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "ledgers_owner_delete"
  on ledgers for delete using (owner_id = auth.uid());

-- accounts
create policy "accounts_member_all"
  on accounts for all using (
    exists(select 1 from ledger_users lu
           where lu.ledger_id = accounts.ledger_id and lu.profile_id = auth.uid())
  ) with check (
    exists(select 1 from ledger_users lu
           where lu.ledger_id = accounts.ledger_id and lu.profile_id = auth.uid())
  );

-- categories
create policy "cats_member_all"
  on categories for all using (
    exists(select 1 from ledger_users lu
           where lu.ledger_id = categories.ledger_id and lu.profile_id = auth.uid())
  ) with check (
    exists(select 1 from ledger_users lu
           where lu.ledger_id = categories.ledger_id and lu.profile_id = auth.uid())
  );

-- transactions
create policy "tx_member_all"
  on transactions for all using (
    exists(select 1 from ledger_users lu
           where lu.ledger_id = transactions.ledger_id and lu.profile_id = auth.uid())
  ) with check (
    exists(select 1 from ledger_users lu
           where lu.ledger_id = transactions.ledger_id and lu.profile_id = auth.uid())
  );

-- budgets
create policy "budgets_member_all"
  on budgets for all using (
    exists(select 1 from ledger_users lu
           where lu.ledger_id = budgets.ledger_id and lu.profile_id = auth.uid())
  ) with check (
    exists(select 1 from ledger_users lu
           where lu.ledger_id = budgets.ledger_id and lu.profile_id = auth.uid())
  );

-- =============================================================
-- 觸發器:每次有新使用者註冊,自動幫他建立
--    profile + 預設帳本「寶寶成長帳本」+ 預設育兒分類 + 現金帳戶
-- =============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_ledger_id uuid;
begin
  -- 1. 建 profile
  insert into profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  -- 2. 建預設帳本
  insert into ledgers (name, type, owner_id)
  values ('寶寶成長帳本', 'shared', new.id)
  returning id into new_ledger_id;

  -- 3. 加自己進帳本
  insert into ledger_users (ledger_id, profile_id, role)
  values (new_ledger_id, new.id, 'owner');

  -- 4. 建預設分類(育兒主題)
  insert into categories (ledger_id, name, icon, type) values
    (new_ledger_id, '寶貝日常', '🍼', 'expense'),
    (new_ledger_id, '教育成長', '📚', 'expense'),
    (new_ledger_id, '醫療保健', '🏥', 'expense'),
    (new_ledger_id, '家庭生活', '🏠', 'expense'),
    (new_ledger_id, '自我愛護', '☕', 'expense'),
    (new_ledger_id, '教育金',   '🎓', 'expense'),
    (new_ledger_id, '薪資收入', '💰', 'income'),
    (new_ledger_id, '其他收入', '🎁', 'income');

  -- 5. 預設一個現金帳戶
  insert into accounts (ledger_id, name, type, balance)
  values (new_ledger_id, '現金錢包', 'cash', 0);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================
-- 回填:讓「在 trigger 建立之前就註冊的使用者」也有 profile + 帳本
-- =============================================================
do $$
declare
  u record;
  new_ledger_id uuid;
begin
  for u in (
    select au.id, au.email
    from auth.users au
    left join ledger_users lu on lu.profile_id = au.id
    where lu.id is null
  ) loop
    -- 補 profile
    insert into profiles (id, email)
    values (u.id, u.email)
    on conflict (id) do nothing;

    -- 建帳本
    insert into ledgers (name, type, owner_id)
    values ('寶寶成長帳本', 'shared', u.id)
    returning id into new_ledger_id;

    insert into ledger_users (ledger_id, profile_id, role)
    values (new_ledger_id, u.id, 'owner');

    -- 預設分類
    insert into categories (ledger_id, name, icon, type) values
      (new_ledger_id, '寶貝日常', '🍼', 'expense'),
      (new_ledger_id, '教育成長', '📚', 'expense'),
      (new_ledger_id, '醫療保健', '🏥', 'expense'),
      (new_ledger_id, '家庭生活', '🏠', 'expense'),
      (new_ledger_id, '自我愛護', '☕', 'expense'),
      (new_ledger_id, '教育金',   '🎓', 'expense'),
      (new_ledger_id, '薪資收入', '💰', 'income'),
      (new_ledger_id, '其他收入', '🎁', 'income');

    -- 預設帳戶
    insert into accounts (ledger_id, name, type, balance)
    values (new_ledger_id, '現金錢包', 'cash', 0);
  end loop;
end $$;
