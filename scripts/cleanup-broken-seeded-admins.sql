begin;

create temporary table seeded_admin_user_ids as
select id
from auth.users
where email like '%@citisense.local'
   or raw_user_meta_data ->> 'username' = 'super_admin_urdaneta'
   or raw_user_meta_data ->> 'username' like 'lgu\_%\_admin' escape '\'
   or raw_user_meta_data ->> 'username' like 'brgy\_%\_admin' escape '\';

delete from auth.one_time_tokens
where user_id in (select id from seeded_admin_user_ids);

delete from auth.flow_state
where user_id in (select id from seeded_admin_user_ids);

delete from auth.mfa_amr_claims
where session_id in (
  select id
  from auth.sessions
  where user_id in (select id from seeded_admin_user_ids)
);

delete from auth.sessions
where user_id in (select id from seeded_admin_user_ids);

delete from auth.refresh_tokens
where user_id in (select id from seeded_admin_user_ids);

delete from auth.mfa_factors
where user_id in (select id from seeded_admin_user_ids);

delete from auth.identities
where user_id in (select id from seeded_admin_user_ids)
   or provider_id like '%@citisense.local';

delete from public.profiles
where id in (select id from seeded_admin_user_ids)
   or username = 'super_admin_urdaneta'
   or username like 'lgu\_%\_admin' escape '\'
   or username like 'brgy\_%\_admin' escape '\';

delete from auth.users
where id in (select id from seeded_admin_user_ids);

drop table seeded_admin_user_ids;

commit;
