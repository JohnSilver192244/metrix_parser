-- P1 performance read-side projections and RPC aggregations.

create table if not exists app_public.player_competition_counts (
  player_id text primary key,
  competitions_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint player_competition_counts_player_id_fkey
    foreign key (player_id) references app_public.players (player_id)
    on delete cascade,
  constraint player_competition_counts_non_negative_check
    check (competitions_count >= 0)
);

create table if not exists app_public.competition_read_model (
  competition_id text primary key,
  has_results boolean not null default false,
  season_points numeric(10, 2),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint competition_read_model_competition_id_fkey
    foreign key (competition_id) references app_public.competitions (competition_id)
    on delete cascade,
  constraint competition_read_model_season_points_check
    check (season_points is null or season_points >= 0)
);

create or replace function app_public.resolve_owner_competition_id(
  p_competition_id text
)
returns text
language plpgsql
stable
as $$
declare
  v_current_competition_id text := p_competition_id;
  v_last_known_competition_id text := p_competition_id;
  v_parent_id text;
  v_record_type text;
  v_parent_record_type text;
  v_has_direct_round_children boolean;
  v_direct_pool_children_with_rounds_count integer;
  v_visited_competition_ids text[] := '{}'::text[];
begin
  while v_current_competition_id is not null
    and not (v_current_competition_id = any(v_visited_competition_ids))
  loop
    v_visited_competition_ids := array_append(v_visited_competition_ids, v_current_competition_id);

    select c.competition_id, nullif(btrim(c.parent_id), ''), c.record_type
    into v_last_known_competition_id, v_parent_id, v_record_type
    from app_public.competitions c
    where c.competition_id = v_current_competition_id;

    if not found then
      return v_last_known_competition_id;
    end if;

    if v_record_type in ('2', '4') then
      if v_record_type = '4' and v_last_known_competition_id <> p_competition_id then
        select count(*)
        into v_direct_pool_children_with_rounds_count
        from app_public.competitions pool_competition
        where pool_competition.parent_id = v_last_known_competition_id
          and pool_competition.record_type = '3'
          and exists (
            select 1
            from app_public.competitions round_competition
            where round_competition.parent_id = pool_competition.competition_id
              and round_competition.record_type = '1'
          );

        if coalesce(v_direct_pool_children_with_rounds_count, 0) > 1 then
          v_current_competition_id := v_parent_id;
          continue;
        end if;
      end if;

      return v_last_known_competition_id;
    end if;

    if v_record_type = '1' and v_parent_id is null then
      return v_last_known_competition_id;
    end if;

    if v_record_type = '3' then
      select exists (
        select 1
        from app_public.competitions direct_round
        where direct_round.parent_id = v_last_known_competition_id
          and direct_round.record_type = '1'
      )
      into v_has_direct_round_children;

      if v_has_direct_round_children then
        if v_parent_id is not null then
          select parent_competition.record_type
          into v_parent_record_type
          from app_public.competitions parent_competition
          where parent_competition.competition_id = v_parent_id;
        else
          v_parent_record_type := null;
        end if;

        if v_parent_record_type = '4' then
          select count(*)
          into v_direct_pool_children_with_rounds_count
          from app_public.competitions sibling_pool
          where sibling_pool.parent_id = v_parent_id
            and sibling_pool.record_type = '3'
            and exists (
              select 1
              from app_public.competitions sibling_round
              where sibling_round.parent_id = sibling_pool.competition_id
                and sibling_round.record_type = '1'
            );

          if coalesce(v_direct_pool_children_with_rounds_count, 0) = 1 then
            return v_parent_id;
          end if;
        end if;

        return v_last_known_competition_id;
      end if;
    end if;

    v_current_competition_id := v_parent_id;
  end loop;

  return v_last_known_competition_id;
end;
$$;

create or replace function app_public.recompute_player_competition_counts_row(
  p_player_id text
)
returns void
language plpgsql
as $$
declare
  v_distinct_competitions_count integer;
begin
  if p_player_id is null or btrim(p_player_id) = '' then
    return;
  end if;

  select count(distinct competition_id)::integer
  into v_distinct_competitions_count
  from app_public.competition_results
  where player_id = p_player_id;

  insert into app_public.player_competition_counts (player_id, competitions_count, updated_at)
  values (p_player_id, coalesce(v_distinct_competitions_count, 0), timezone('utc', now()))
  on conflict (player_id) do update
  set competitions_count = excluded.competitions_count,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function app_public.recompute_competition_read_model_row(
  p_competition_id text
)
returns void
language plpgsql
as $$
declare
  v_has_results boolean;
  v_season_points numeric(10, 2);
begin
  if p_competition_id is null or btrim(p_competition_id) = '' then
    return;
  end if;

  select exists (
    select 1
    from app_public.competition_results competition_result
    where competition_result.competition_id = p_competition_id
  )
  into v_has_results;

  with season_totals as (
    select
      season_row.season_code,
      count(distinct season_row.player_id)::integer as players_count,
      sum(season_row.season_points)::numeric(10, 2) as total_points
    from app_public.season_standings season_row
    where season_row.competition_id = p_competition_id
    group by season_row.season_code
  )
  select season_totals.total_points
  into v_season_points
  from season_totals
  order by season_totals.players_count desc, season_totals.season_code desc
  limit 1;

  insert into app_public.competition_read_model (
    competition_id,
    has_results,
    season_points,
    updated_at
  )
  values (
    p_competition_id,
    coalesce(v_has_results, false),
    v_season_points,
    timezone('utc', now())
  )
  on conflict (competition_id) do update
  set has_results = excluded.has_results,
      season_points = excluded.season_points,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function app_public.rebuild_player_competition_counts()
returns void
language plpgsql
as $$
begin
  delete from app_public.player_competition_counts;

  insert into app_public.player_competition_counts (player_id, competitions_count, updated_at)
  select
    player.player_id,
    coalesce(count(distinct result.competition_id), 0)::integer as competitions_count,
    timezone('utc', now())
  from app_public.players player
  left join app_public.competition_results result
    on result.player_id = player.player_id
  group by player.player_id;
end;
$$;

create or replace function app_public.rebuild_competition_read_model()
returns void
language plpgsql
as $$
begin
  delete from app_public.competition_read_model;

  insert into app_public.competition_read_model (
    competition_id,
    has_results,
    season_points,
    updated_at
  )
  select
    competition.competition_id,
    exists (
      select 1
      from app_public.competition_results competition_result
      where competition_result.competition_id = competition.competition_id
    ) as has_results,
    (
      with season_totals as (
        select
          season_row.season_code,
          count(distinct season_row.player_id)::integer as players_count,
          sum(season_row.season_points)::numeric(10, 2) as total_points
        from app_public.season_standings season_row
        where season_row.competition_id = competition.competition_id
        group by season_row.season_code
      )
      select season_totals.total_points
      from season_totals
      order by season_totals.players_count desc, season_totals.season_code desc
      limit 1
    ) as season_points,
    timezone('utc', now())
  from app_public.competitions competition;
end;
$$;

create or replace function app_public.sync_player_competition_counts_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform app_public.recompute_player_competition_counts_row(new.player_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform app_public.recompute_player_competition_counts_row(new.player_id);
    if old.player_id is distinct from new.player_id then
      perform app_public.recompute_player_competition_counts_row(old.player_id);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform app_public.recompute_player_competition_counts_row(old.player_id);
    return old;
  end if;

  return null;
end;
$$;

create or replace function app_public.sync_competition_read_model_from_results_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform app_public.recompute_competition_read_model_row(new.competition_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform app_public.recompute_competition_read_model_row(new.competition_id);
    if old.competition_id is distinct from new.competition_id then
      perform app_public.recompute_competition_read_model_row(old.competition_id);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform app_public.recompute_competition_read_model_row(old.competition_id);
    return old;
  end if;

  return null;
end;
$$;

create or replace function app_public.sync_competition_read_model_from_season_standings_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform app_public.recompute_competition_read_model_row(new.competition_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform app_public.recompute_competition_read_model_row(new.competition_id);
    if old.competition_id is distinct from new.competition_id then
      perform app_public.recompute_competition_read_model_row(old.competition_id);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform app_public.recompute_competition_read_model_row(old.competition_id);
    return old;
  end if;

  return null;
end;
$$;

create or replace function app_public.sync_competition_read_model_from_competitions_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform app_public.recompute_competition_read_model_row(new.competition_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform app_public.recompute_competition_read_model_row(new.competition_id);
    if old.competition_id is distinct from new.competition_id then
      delete from app_public.competition_read_model where competition_id = old.competition_id;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    delete from app_public.competition_read_model where competition_id = old.competition_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists competition_results_sync_player_competition_counts
  on app_public.competition_results;

create trigger competition_results_sync_player_competition_counts
after insert or update or delete on app_public.competition_results
for each row
execute function app_public.sync_player_competition_counts_trigger();

drop trigger if exists competition_results_sync_competition_read_model
  on app_public.competition_results;

create trigger competition_results_sync_competition_read_model
after insert or update or delete on app_public.competition_results
for each row
execute function app_public.sync_competition_read_model_from_results_trigger();

drop trigger if exists season_standings_sync_competition_read_model
  on app_public.season_standings;

create trigger season_standings_sync_competition_read_model
after insert or update or delete on app_public.season_standings
for each row
execute function app_public.sync_competition_read_model_from_season_standings_trigger();

drop trigger if exists competitions_sync_competition_read_model
  on app_public.competitions;

create trigger competitions_sync_competition_read_model
after insert or update or delete on app_public.competitions
for each row
execute function app_public.sync_competition_read_model_from_competitions_trigger();

create index if not exists player_competition_counts_competitions_count_idx
  on app_public.player_competition_counts (competitions_count);

create index if not exists competition_read_model_has_results_idx
  on app_public.competition_read_model (has_results);

create index if not exists competition_read_model_season_points_idx
  on app_public.competition_read_model (season_points);

create or replace function app_public.get_player_results_aggregated(
  p_player_id text,
  p_season_code text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_limit integer default 500,
  p_offset integer default 0
)
returns table (
  competition_id text,
  competition_name text,
  competition_date date,
  category text,
  placement integer,
  sum integer,
  dnf boolean,
  season_points numeric(10, 2)
)
language sql
stable
as $$
  with player_rows as (
    select
      result.competition_id,
      result.sum,
      result.dnf
    from app_public.competition_results result
    where result.player_id = p_player_id
  ),
  mapped_rows as (
    select
      player_row.competition_id as source_competition_id,
      app_public.resolve_owner_competition_id(player_row.competition_id) as owner_competition_id,
      player_row.sum,
      player_row.dnf
    from player_rows player_row
  ),
  owner_competitions as (
    select
      competition.competition_id,
      competition.competition_name,
      competition.competition_date,
      coalesce(category.name, competition.category_id) as category
    from app_public.competitions competition
    left join app_public.tournament_categories category
      on category.category_id = competition.category_id
    where competition.competition_id in (
      select distinct mapped.owner_competition_id
      from mapped_rows mapped
    )
      and (p_date_from is null or competition.competition_date >= p_date_from)
      and (p_date_to is null or competition.competition_date <= p_date_to)
  ),
  visible_mapped_rows as (
    select
      mapped.source_competition_id,
      mapped.owner_competition_id,
      mapped.sum,
      mapped.dnf
    from mapped_rows mapped
    inner join owner_competitions owner_competition
      on owner_competition.competition_id = mapped.owner_competition_id
  ),
  ranked_rows as (
    select
      ranked_result.competition_id,
      ranked_result.player_id,
      rank() over (
        partition by ranked_result.competition_id
        order by ranked_result.sum asc nulls last, ranked_result.player_id asc
      )::integer as placement
    from app_public.competition_results ranked_result
    where ranked_result.competition_id in (
      select distinct visible_mapped.source_competition_id
      from visible_mapped_rows visible_mapped
    )
      and ranked_result.dnf is false
      and ranked_result.sum is not null
  ),
  season_rows as (
    select
      season_row.competition_id,
      season_row.season_points,
      season_row.placement
    from app_public.season_standings season_row
    where p_season_code is not null
      and season_row.player_id = p_player_id
      and season_row.season_code = p_season_code
      and season_row.competition_id in (
        select owner_competition.competition_id
        from owner_competitions owner_competition
      )
  ),
  selected_rows as (
    select
      visible_mapped.owner_competition_id,
      visible_mapped.source_competition_id,
      visible_mapped.sum,
      visible_mapped.dnf,
      row_number() over (
        partition by visible_mapped.owner_competition_id
        order by
          case when visible_mapped.dnf is false and visible_mapped.sum is not null then 1 else 0 end desc,
          case when visible_mapped.source_competition_id = visible_mapped.owner_competition_id then 1 else 0 end desc,
          visible_mapped.sum asc nulls last,
          visible_mapped.source_competition_id asc
      ) as row_priority
    from visible_mapped_rows visible_mapped
  )
  select
    owner_competition.competition_id,
    owner_competition.competition_name,
    owner_competition.competition_date,
    owner_competition.category,
    coalesce(season_row.placement, ranked_row.placement) as placement,
    selected_row.sum,
    case
      when season_row.placement is not null then false
      else selected_row.dnf
    end as dnf,
    season_row.season_points
  from selected_rows selected_row
  inner join owner_competitions owner_competition
    on owner_competition.competition_id = selected_row.owner_competition_id
  left join ranked_rows ranked_row
    on ranked_row.competition_id = selected_row.source_competition_id
   and ranked_row.player_id = p_player_id
  left join season_rows season_row
    on season_row.competition_id = selected_row.owner_competition_id
  where selected_row.row_priority = 1
  order by owner_competition.competition_date desc, owner_competition.competition_name asc
  limit greatest(coalesce(p_limit, 500), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

select app_public.rebuild_player_competition_counts();
select app_public.rebuild_competition_read_model();
