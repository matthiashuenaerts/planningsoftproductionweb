-- Add set_tenant_id_on_insert trigger to ALL tenant-scoped tables
-- This ensures the correct tenant_id is always set based on the authenticated user

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'accessories','broken_parts','cabinet_compartments','cabinet_configurations',
    'cabinet_fronts','cabinet_materials','cabinet_models','cabinet_parts',
    'cabinet_price_rules','cabinet_project_revisions','cabinet_projects',
    'cabinet_quotes','calculation_task_relationships','chat_messages','chat_rooms',
    'compartment_items','csv_import_configs','daily_team_assignments',
    'email_configurations','email_schedule_configs','employee_standard_task_links',
    'employee_workstation_links','employees','external_api_configs','front_hardware',
    'gantt_schedules','help_articles','help_categories','holiday_requests','holidays',
    'legrabox_configurations','notifications','order_attachments','order_items',
    'order_steps','orders','orders_sync_logs','parts','parts_lists','pdf_annotations',
    'personal_item_attachments','personal_item_shares','personal_items','phase_offsets',
    'phases','placement_team_members','placement_teams','product_group_items',
    'product_groups','production_flow_lines','production_route_tasks','production_routes',
    'products','project_calculation_variables','project_costing',
    'project_loading_overrides','project_message_reads','project_messages',
    'project_models','project_onedrive_configs','project_production_completion',
    'project_sync_logs','project_team_assignment_overrides','project_team_assignments',
    'project_truck_assignments','projects','recurring_task_schedules','role_permissions',
    'rush_order_assignments','rush_order_messages','rush_order_task_links',
    'rush_order_tasks','rush_orders','schedules','standard_task_checklists',
    'standard_task_limit_phases','standard_task_workstation_links','standard_tasks',
    'stock_locations','storage_system','suppliers','task_completion_checklists',
    'task_workstation_links','tasks','tenant_aliases','time_registrations','trucks',
    'user_preferences','user_roles','work_hours','working_hours',
    'working_hours_breaks','workstation_errors','workstation_positions',
    'workstation_schedules','workstation_tasks','workstations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER set_tenant_id_on_insert
       BEFORE INSERT ON public.%I
       FOR EACH ROW
       EXECUTE FUNCTION public.set_tenant_id_on_insert()',
      tbl
    );
  END LOOP;
END
$$;