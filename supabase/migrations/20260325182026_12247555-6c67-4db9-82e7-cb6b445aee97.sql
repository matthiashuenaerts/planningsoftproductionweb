-- Remove the broken cron job 2 that has invalid JSON concat and leaked credentials
SELECT cron.unschedule(2);