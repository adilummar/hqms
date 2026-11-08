-- Staff FN/AN automatic absence: exact-time schedule using Supabase pg_cron + pg_net.
--
-- NOT executed by the app. Run this manually in the Supabase SQL editor AFTER:
--   1. drizzle/0008_staff_attendance_sessions.sql has been applied,
--   2. CRON_SECRET is set in the Vercel project (and redeployed),
--   3. the pg_cron and pg_net extensions are enabled
--      (Supabase dashboard → Database → Extensions).
--
-- Replace <APP_URL> (e.g. https://your-app.vercel.app) and <CRON_SECRET> below.
-- pg_cron schedules are in UTC. India has no daylight saving:
--   14:00 IST = 08:30 UTC   (FN cutoff)
--   23:00 IST = 17:30 UTC   (AN cutoff)
--
-- The Vercel cron (vercel.json, 18:30 UTC = 00:00 IST) re-runs the same route as a
-- catch-up sweep. The route is idempotent, so extra runs are harmless.

select cron.schedule(
  'staff-fn-absent-1400-ist',
  '30 8 * * *',
  $$
  select net.http_get(
    url := '<APP_URL>/api/cron/staff-session-absent',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);

select cron.schedule(
  'staff-an-absent-2300-ist',
  '30 17 * * *',
  $$
  select net.http_get(
    url := '<APP_URL>/api/cron/staff-session-absent',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);

-- Inspect / remove:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select cron.unschedule('staff-fn-absent-1400-ist');
--   select cron.unschedule('staff-an-absent-2300-ist');
