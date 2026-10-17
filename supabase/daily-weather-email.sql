-- GeoNEXA AI — daily 6:00 AM weather email. Run in Supabase SQL Editor (2 parts).

-- ===== PART 1: who gets the email =====
-- Only confirmed, non-deactivated users who have not turned off Email or the
-- weather toggle (Settings → Notifications). Place = the province/district
-- typed at signup (falls back to Kigali).
create or replace function public.get_weather_email_recipients()
returns table(email text, full_name text, place text)
language sql
security definer
set search_path = public, auth
as $$
  -- to_jsonb(p) reads optional columns by name, so this works even if a
  -- column (province, is_deactivated, preferences) does not exist yet.
  select u.email::text,
         to_jsonb(p) ->> 'full_name',
         coalesce(nullif(trim(to_jsonb(p) ->> 'province'), ''), 'Kigali') as place
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email is not null
    and u.email_confirmed_at is not null
    and coalesce((to_jsonb(p) ->> 'is_deactivated')::boolean, false) = false
    and coalesce((to_jsonb(p) -> 'preferences' -> 'notifications' ->> 'email')::boolean, true)
    and coalesce((to_jsonb(p) -> 'preferences' -> 'notifications' ->> 'weather')::boolean, true);
$$;

revoke all on function public.get_weather_email_recipients() from public, anon, authenticated;
grant execute on function public.get_weather_email_recipients() to service_role;

-- ===== PART 2: schedule (run AFTER the edge function is deployed) =====
-- (Function slug in this project is swift-processor.)
-- Rwanda is UTC+2, so 6:00 AM Kigali = 04:00 UTC.
-- Replace REPLACE_WITH_YOUR_CRON_SECRET with the same value you saved as the
-- CRON_SECRET edge-function secret.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('daily-weather-email')
where exists (select 1 from cron.job where jobname = 'daily-weather-email');

select cron.schedule(
  'daily-weather-email',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://ogwckglzluhjwmucrodb.supabase.co/functions/v1/swift-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'REPLACE_WITH_YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Check it is scheduled:   select jobname, schedule from cron.job;
-- Turn it off entirely:    select cron.unschedule('daily-weather-email');
