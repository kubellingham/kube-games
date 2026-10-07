-- Optional: schedule room cleanup with pg_cron.
-- The app server also cleans up opportunistically whenever a room is created,
-- so this migration is allowed to no-op where pg_cron is unavailable.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;

  perform cron.schedule(
    'cleanup-game-rooms',
    '*/5 * * * *',
    'select private.cleanup_game_rooms()'
  );
exception
  when others then
    raise notice 'Skipping pg_cron schedule for game room cleanup: %', sqlerrm;
end;
$$;
