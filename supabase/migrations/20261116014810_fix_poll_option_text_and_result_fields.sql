-- Return the poll option field names and result aggregates consumed by the UI.
-- Keep option_text for compatibility while adding text, votes, percent and total_votes.
create or replace function public.app_get_polls(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  me public.accounts;
begin
  me := public.bm_auth(p_token);

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'description', p.description,
        'is_active', p.is_active,
        'created_at', p.created_at,
        'total_votes', coalesce(stats.total_votes, 0),
        'options', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', o.id,
              'text', o.option_text,
              'option_text', o.option_text,
              'sort_order', o.sort_order,
              'votes', coalesce(option_stats.vote_count, 0),
              'percent', case
                when coalesce(stats.total_votes, 0) = 0 then 0
                else round(100.0 * coalesce(option_stats.vote_count, 0) / stats.total_votes, 1)
              end
            )
            order by o.sort_order, o.id
          )
          from public.building_poll_options o
          left join lateral (
            select count(*)::integer as vote_count
            from public.building_poll_votes v
            where v.poll_id = p.id and v.option_id = o.id
          ) option_stats on true
          where o.poll_id = p.id
        ), '[]'::jsonb),
        'my_vote', (
          select v.option_id
          from public.building_poll_votes v
          where v.poll_id = p.id and v.account_id = me.id
          limit 1
        )
      )
      order by p.created_at desc, p.id desc
    )
    from public.building_polls p
    left join lateral (
      select count(*)::integer as total_votes
      from public.building_poll_votes v
      where v.poll_id = p.id
    ) stats on true
    where p.building_id = me.building_id
  ), '[]'::jsonb);
end
$function$;
