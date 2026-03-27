SELECT cron.unschedule('project-sync-automated');
SELECT cron.unschedule('orders-sync-automated');

SELECT cron.schedule(
  'project-sync-dispatcher',
  '0 */2 * * *',
  $$SELECT public.trigger_project_sync_per_tenant();$$
);

SELECT cron.schedule(
  'orders-sync-dispatcher',
  '30 */2 * * *',
  $$SELECT public.trigger_orders_sync_per_tenant();$$
);