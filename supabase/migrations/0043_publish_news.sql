-- ============================================================================
-- 0043_publish_news: Vereins-News publizieren (UC-026)
--
-- News sind hier nicht Beiwerk, sondern die **Gegenseite der Aufrufe**: Sie
-- zählen in der Verbindungs-Quote als Verbindung (BR-111), und genau diese
-- Quote entscheidet, ob ein Verein gebremst wird, wenn er das nächste Mal um
-- Hilfe bittet (K1, `call_is_muted()`). Ohne einen Weg, News zu schreiben,
-- kann ein Verein die sanfte Sperre gar nicht lösen – er kann nur bitten.
--
-- Dazu ein Befund derselben Art wie bei `tasks` in `0034`: **Der
-- Geltungsbereich war wirkungslos.** `news_read` liess jedes Vereinsmitglied
-- jede Team-News lesen.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BR-109: Eine Team-News erreicht ausschliesslich die Mitglieder dieses Teams.
--
-- Trainer:innen und der Vorstand sehen alles – sie verantworten, was steht.
-- ---------------------------------------------------------------------------
drop policy if exists news_read on news;
create policy news_read on news
  for select using (
    is_club_member(club_id)
    and (
      team_id is null
      or is_club_trainer(club_id)
      or exists (
        select 1 from team_members tm
         where tm.team_id = news.team_id
           and tm.member_id = current_member_id(news.club_id)
      )
    )
  );

-- Die Voraussetzung nennt trainer **oder** admin.
drop policy if exists news_admin_write on news;
drop policy if exists news_trainer_write on news;
create policy news_trainer_write on news
  for all using (is_club_trainer(club_id)) with check (is_club_trainer(club_id));

-- ---------------------------------------------------------------------------
-- Schritte 5 bis 8: publizieren.
--
-- Anlegen, zustellen und zählen gehören zusammen. Eine News, die im Feed steht
-- und niemanden erreicht hat, ist die halbe Nachricht – und eine, die nicht
-- gezählt wird, hilft dem Verein bei der Quote nicht.
-- ---------------------------------------------------------------------------
create or replace function public.publish_news(
  p_title     text,
  p_body      text,
  p_club_id   uuid,
  p_team_id   uuid    default null,
  p_image_url text    default null,
  p_source    text    default 'club'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_news   uuid;
  v_person record;
begin
  if not is_club_trainer(p_club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand schreiben News';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'Eine News braucht einen Titel';
  end if;

  if p_team_id is not null
     and not exists (select 1 from teams where id = p_team_id and club_id = p_club_id) then
    raise exception 'Dieses Team gehört nicht zu diesem Verein';
  end if;

  insert into news (club_id, team_id, source, title, body, image_url)
  values (
    p_club_id, p_team_id,
    -- A2: Eine News aus einer Vorstandsantwort trägt ihren Ursprung; UC-030
    -- muss dafür nur diesen Wert setzen.
    case when p_source in ('club','team','federation','website') then p_source
         else 'club' end,
    trim(p_title), nullif(trim(p_body), ''), nullif(trim(p_image_url), '')
  )
  returning id into v_news;

  -- BR-110: Die Inbox erreicht alle, unabhängig von Push.
  -- BR-109: und nur den gewählten Geltungsbereich.
  for v_person in
    select distinct m.user_id
      from club_members m
      left join team_members tm on tm.member_id = m.id
     where m.club_id = p_club_id
       and m.status <> 'left'
       and m.user_id is not null
       and (p_team_id is null or tm.team_id = p_team_id)
  loop
    perform notify(
      v_person.user_id, 'news', trim(p_title),
      left(coalesce(nullif(trim(p_body), ''), ''), 160),
      '/tabs/dashboard', p_club_id
    );
  end loop;

  -- BR-111: Eine News ist eine Verbindung. Das ist der Eintrag, der die sanfte
  -- Sperre aus UC-011 wieder löst.
  perform log_club_message(p_club_id, 'connection', 'news:' || p_source);

  return v_news;
end;
$$;

-- ---------------------------------------------------------------------------
-- A4: zurückziehen.
--
-- Die News verschwindet aus dem Feed, **der Eintrag in der Inbox bleibt**. Eine
-- Nachricht, die rückwirkend verschwindet, wäre schlimmer als ein Verweis, der
-- ins Leere führt: Wer sie gelesen hat, soll sich nicht fragen, ob er sie
-- geträumt hat.
-- ---------------------------------------------------------------------------
create or replace function public.retract_news(p_news_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from news where id = p_news_id;
  if v_club is null then
    raise exception 'News nicht gefunden';
  end if;

  if not is_club_trainer(v_club) then
    raise exception 'Nur Trainer:innen und der Vorstand ziehen News zurück';
  end if;

  delete from news where id = p_news_id;
end;
$$;

revoke execute on function public.publish_news(text, text, uuid, uuid, text, text)
  from public, anon;
grant  execute on function public.publish_news(text, text, uuid, uuid, text, text)
  to authenticated;

revoke execute on function public.retract_news(uuid) from public, anon;
grant  execute on function public.retract_news(uuid) to authenticated;
