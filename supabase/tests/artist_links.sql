-- Run against a disposable, migrated database.
begin;

insert into auth.users (id) values
    ('11111111-1111-4111-8111-111111111111'),
    ('22222222-2222-4222-8222-222222222222');
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $$
declare
    artist uuid := '00000000-0000-4000-8000-000000000001';
    link uuid := '00000000-0000-4000-8000-000000000002';
    other_link uuid := '00000000-0000-4000-8000-000000000003';
    url text := 'https://en.wikipedia.org/wiki/Alice_Coltrane';
    link_row jsonb := jsonb_build_object('id', link, 'artist_id', artist, 'url', url);
    result jsonb;
begin
    result := public.save_library_changes(jsonb_build_object(
        'artists', jsonb_build_object('saved', jsonb_build_array(jsonb_build_object('id', artist, 'name', 'Alice Coltrane'))),
        'artist_links', jsonb_build_object('saved', jsonb_build_array(link_row))
    ));
    if result->'artist_links'->0->>'url' is distinct from url then
        raise exception 'Artist link missing from save result';
    end if;

    result := public.save_library_changes(jsonb_build_object(
        'artist_links', jsonb_build_object('saved', jsonb_build_array(link_row || '{"label":"Biography"}'))
    ));
    if result->'artist_links'->0->>'label' is distinct from 'Biography'
        or (result->'artists'->0->>'id')::uuid is distinct from artist then
        raise exception 'Link-only edit did not return both updated records';
    end if;

    begin
        insert into public.artist_links (id, artist_id, url) values (other_link, artist, url);
        raise exception 'Duplicate link was accepted';
    exception when unique_violation then null;
    end;

    perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
    if exists (select from public.artist_links where id = link) then
        raise exception 'Artist link was visible to another user';
    end if;
    begin
        insert into public.artist_links (id, artist_id, url) values (other_link, artist, 'https://example.com');
        raise exception 'Cross-owner link was accepted';
    exception when foreign_key_violation then null;
    end;

    perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
    result := public.save_library_changes(jsonb_build_object(
        'artist_links', jsonb_build_object('deleted', jsonb_build_array(jsonb_build_object('id', link)))
    ));
    if exists (select from public.artist_links where id = link)
        or (result->'artists'->0->>'id')::uuid is distinct from artist then
        raise exception 'Link deletion did not remove the link and touch the artist';
    end if;

    insert into public.artist_links (id, artist_id, url) values (link, artist, url);
    perform public.save_library_changes(jsonb_build_object(
        'artists', jsonb_build_object('deleted', jsonb_build_array(jsonb_build_object('id', artist)))
    ));
    if exists (select from public.artist_links where id = link) then
        raise exception 'Deleting the artist left an orphaned link';
    end if;
end;
$$;

rollback;
