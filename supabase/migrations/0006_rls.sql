-- ============================================================================
-- 0006_rls: Mandantentrennung
-- Architektur §5.4/§10: Rollenprüfung serverseitig, nie nur im Frontend.
-- Grundregel: Man sieht die Daten der Vereine, in denen man Mitglied ist.
-- ============================================================================

alter table clubs             enable row level security;
alter table teams             enable row level security;
alter table club_members      enable row level security;
alter table team_members      enable row level security;
alter table invites           enable row level security;
alter table join_requests     enable row level security;
alter table point_rules       enable row level security;
alter table point_transactions enable row level security;
alter table events            enable row level security;
alter table event_shifts      enable row level security;
alter table attendance        enable row level security;
alter table tasks             enable row level security;
alter table task_assignments  enable row level security;
alter table news              enable row level security;
alter table notifications     enable row level security;
alter table push_tokens       enable row level security;

-- --- Verein -----------------------------------------------------------------
create policy clubs_read on clubs
  for select using (is_club_member(id));
create policy clubs_update on clubs
  for update using (is_club_admin(id)) with check (is_club_admin(id));

-- --- Mitglieder -------------------------------------------------------------
create policy members_read on club_members
  for select using (is_club_member(club_id));
-- Eigenes Profil pflegen; Rollenwechsel bleibt dem Vorstand vorbehalten.
create policy members_update_self on club_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_admin_write on club_members
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

-- --- Teams ------------------------------------------------------------------
create policy teams_read on teams
  for select using (is_club_member(club_id));
create policy teams_admin_write on teams
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

create policy team_members_read on team_members
  for select using (
    exists (select 1 from teams t where t.id = team_id and is_club_member(t.club_id))
  );
create policy team_members_admin_write on team_members
  for all using (
    exists (select 1 from teams t where t.id = team_id and is_club_admin(t.club_id))
  ) with check (
    exists (select 1 from teams t where t.id = team_id and is_club_admin(t.club_id))
  );

-- --- Einladungen und Anfragen ----------------------------------------------
-- Einladungen werden über redeem_invite() eingelöst, nicht gelesen: Der Code
-- ist ein Geheimnis und darf nicht auflistbar sein.
create policy invites_admin on invites
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

create policy join_requests_own on join_requests
  for select using (user_id = auth.uid() or is_club_admin(club_id));
create policy join_requests_insert on join_requests
  for insert with check (user_id = auth.uid());
create policy join_requests_decide on join_requests
  for update using (is_club_admin(club_id)) with check (is_club_admin(club_id));

-- --- Punkte -----------------------------------------------------------------
create policy point_rules_read on point_rules
  for select using (is_club_member(club_id));
create policy point_rules_admin_write on point_rules
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

-- Lesen ja, schreiben nie: Der Ledger wird ausschliesslich über
-- award_points() befüllt (security definer, umgeht RLS bewusst).
create policy point_tx_read on point_transactions
  for select using (is_club_member(club_id));

-- --- Agenda -----------------------------------------------------------------
create policy events_read on events
  for select using (is_club_member(club_id));
create policy events_admin_write on events
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

create policy shifts_read on event_shifts
  for select using (
    exists (select 1 from events e where e.id = event_id and is_club_member(e.club_id))
  );
create policy shifts_admin_write on event_shifts
  for all using (
    exists (select 1 from events e where e.id = event_id and is_club_admin(e.club_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_club_admin(e.club_id))
  );

create policy attendance_read on attendance
  for select using (
    exists (select 1 from events e where e.id = event_id and is_club_member(e.club_id))
  );
-- Zu- und Absagen darf jede Person nur für sich selbst setzen. Der Status
-- 'present' bleibt dem Check-in und der Vorstandsbestätigung vorbehalten.
create policy attendance_write_self on attendance
  for insert with check (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and status in ('registered','excused','absent')
  );
create policy attendance_update_self on attendance
  for update using (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
  ) with check (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and status in ('registered','excused','absent')
  );
create policy attendance_admin on attendance
  for all using (
    exists (select 1 from events e where e.id = event_id and is_club_admin(e.club_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_club_admin(e.club_id))
  );

-- --- Marktplatz -------------------------------------------------------------
create policy tasks_read on tasks
  for select using (is_club_member(club_id));
create policy tasks_admin_write on tasks
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

create policy task_assignments_read on task_assignments
  for select using (
    exists (select 1 from tasks t where t.id = task_id and is_club_member(t.club_id))
  );
-- Übernehmen läuft über claim_task(); Abmelden darf man selbst.
create policy task_assignments_delete_self on task_assignments
  for delete using (
    member_id = (select current_member_id(t.club_id) from tasks t where t.id = task_id)
    and confirmed_at is null
  );
create policy task_assignments_submit_self on task_assignments
  for update using (
    member_id = (select current_member_id(t.club_id) from tasks t where t.id = task_id)
  ) with check (
    member_id = (select current_member_id(t.club_id) from tasks t where t.id = task_id)
  );

-- --- News und Inbox ---------------------------------------------------------
create policy news_read on news
  for select using (is_club_member(club_id));
create policy news_admin_write on news
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

create policy notifications_own on notifications
  for select using (user_id = auth.uid());
create policy notifications_mark_read on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_tokens_own on push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
