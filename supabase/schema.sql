create extension if not exists btree_gist;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  role text not null default 'user' check (role in ('user','owner','admin'))
);

create table resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  name text not null,
  type text not null,
  location text,
  rules text,
  max_hours_per_week int not null default 8,
  created_at timestamptz default now()
);

create table requirements (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id) on delete cascade,
  label text not null
);

create table credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  label text not null,
  status text not null default 'pending' check (status in ('pending','verified'))
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id),
  user_id uuid not null references profiles(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'pending_review',
  reason text,
  created_at timestamptz default now(),
  constraint no_overlap exclude using gist (
    resource_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status in ('approved','checked_in'))
);

create table condition_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  phase text not null check (phase in ('before','after')),
  notes text,
  photo_url text,
  damage boolean not null default false,
  created_at timestamptz default now()
);

create table audit_log (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  booking_id uuid references bookings(id),
  action text not null,
  from_status text,
  to_status text,
  reason text,
  created_at timestamptz default now()
);

create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, name, role) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    case when new.raw_user_meta_data->>'role' = 'owner' then 'owner' else 'user' end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

alter table profiles enable row level security;
alter table resources enable row level security;
alter table requirements enable row level security;
alter table credentials enable row level security;
alter table bookings enable row level security;
alter table condition_reports enable row level security;
alter table audit_log enable row level security;

create policy profiles_sel on profiles for select to authenticated using (true);

create policy resources_sel on resources for select to authenticated using (true);
create policy resources_ins on resources for insert to authenticated with check (owner_id = auth.uid());
create policy resources_upd on resources for update to authenticated using (owner_id = auth.uid());
create policy resources_del on resources for delete to authenticated using (owner_id = auth.uid());

create policy req_sel on requirements for select to authenticated using (true);
create policy req_ins on requirements for insert to authenticated
  with check (exists (select 1 from resources r where r.id = resource_id and r.owner_id = auth.uid()));

create policy cred_sel on credentials for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin')));
create policy cred_ins on credentials for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy cred_upd on credentials for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'owner'));

create policy bookings_sel on bookings for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from resources r where r.id = resource_id and r.owner_id = auth.uid()));

create policy reports_sel on condition_reports for select to authenticated
  using (exists (select 1 from bookings b where b.id = booking_id));

create policy audit_sel on audit_log for select to authenticated
  using (exists (select 1 from bookings b where b.id = booking_id)
         or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create function request_booking(p_resource uuid, p_start timestamptz, p_end timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  res resources;
  missing text;
  used numeric;
  want numeric;
  st text := 'pending_review';
  why text;
  new_id uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_end <= p_start then raise exception 'End must be after start'; end if;
  select * into res from resources where id = p_resource;
  if not found then raise exception 'Resource not found'; end if;

  select string_agg(q.label, ', ') into missing
  from requirements q
  where q.resource_id = p_resource
    and not exists (select 1 from credentials c where c.user_id = me and c.label = q.label and c.status = 'verified');
  if missing is not null then raise exception 'Not eligible. Missing verified: %', missing; end if;

  if exists (select 1 from bookings where resource_id = p_resource and status in ('approved','checked_in')
             and start_time < p_end and end_time > p_start) then
    raise exception 'Time slot conflicts with an existing booking';
  end if;

  want := extract(epoch from (p_end - p_start)) / 3600;
  select coalesce(sum(extract(epoch from (end_time - start_time)) / 3600), 0) into used
  from bookings
  where user_id = me and resource_id = p_resource
    and status in ('pending_review','approved','checked_in','returned','disputed','closed')
    and date_trunc('week', start_time) = date_trunc('week', p_start);

  if used + want > res.max_hours_per_week then
    st := 'waitlisted';
    why := format('Waitlisted: %s of %s weekly hours already used, this request adds %s', used, res.max_hours_per_week, want);
  end if;

  insert into bookings(resource_id, user_id, start_time, end_time, status, reason)
  values (p_resource, me, p_start, p_end, st, why) returning id into new_id;

  insert into audit_log(actor_id, booking_id, action, from_status, to_status, reason)
  values (me, new_id, 'request', null, st, why);

  return new_id;
end $$;

create function transition_booking(
  p_id uuid, p_action text, p_reason text default null,
  p_notes text default null, p_photo text default null, p_damage boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b bookings;
  v_owner uuid;
  nxt text;
  who text;
begin
  select * into b from bookings where id = p_id for update;
  if not found then raise exception 'Booking not found'; end if;
  select owner_id into v_owner from resources where id = b.resource_id;

  if p_action = 'approve' and b.status in ('pending_review','waitlisted') then nxt := 'approved'; who := 'owner';
  elsif p_action = 'reject' and b.status in ('pending_review','waitlisted') then nxt := 'rejected'; who := 'owner';
  elsif p_action = 'waitlist' and b.status = 'pending_review' then nxt := 'waitlisted'; who := 'owner';
  elsif p_action = 'cancel' and b.status in ('pending_review','waitlisted','approved') then nxt := 'cancelled'; who := 'user';
  elsif p_action = 'checkin' and b.status = 'approved' then nxt := 'checked_in'; who := 'user';
  elsif p_action = 'return' and b.status = 'checked_in' then nxt := case when p_damage then 'disputed' else 'returned' end; who := 'user';
  elsif p_action = 'close' and b.status = 'returned' then nxt := 'closed'; who := 'owner';
  elsif p_action = 'resolve' and b.status = 'disputed' then nxt := 'closed'; who := 'owner';
  else raise exception 'Invalid transition: % from %', p_action, b.status;
  end if;

  if who = 'owner' and me is distinct from v_owner then raise exception 'Forbidden'; end if;
  if who = 'user' and me is distinct from b.user_id then raise exception 'Forbidden'; end if;
  if p_action in ('approve','reject','waitlist','resolve') and coalesce(trim(p_reason), '') = '' then
    raise exception 'Reason required';
  end if;

  if p_action = 'checkin' then
    insert into condition_reports(booking_id, phase, notes, photo_url) values (p_id, 'before', p_notes, p_photo);
  elsif p_action = 'return' then
    insert into condition_reports(booking_id, phase, notes, photo_url, damage) values (p_id, 'after', p_notes, p_photo, p_damage);
  end if;

  update bookings set status = nxt, reason = coalesce(p_reason, reason) where id = p_id;

  insert into audit_log(actor_id, booking_id, action, from_status, to_status, reason)
  values (me, p_id, p_action, b.status, nxt, coalesce(p_reason, p_notes));
end $$;
