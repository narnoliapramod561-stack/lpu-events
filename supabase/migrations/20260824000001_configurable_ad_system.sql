-- 20260824000001_configurable_ad_system.sql
-- Multi-Provider Advertisement System Centralized Configuration

insert into public.global_settings (key, value, description, updated_by)
values (
  'ad_system_config',
  jsonb_build_object(
    'global_enabled', true,
    'max_ads_per_page', 10,
    'adsense', jsonb_build_object(
      'publisher_id', 'ca-pub-0000000000000000',
      'auto_ads_enabled', false,
      'test_mode', true
    ),
    'placements', jsonb_build_object(
      'hero_carousel', jsonb_build_object(
        'enabled', true,
        'provider', 'direct',
        'frequency', 2,
        'max_ads', 3,
        'ad_unit_id', '1000000001'
      ),
      'happening_today', jsonb_build_object(
        'enabled', true,
        'provider', 'direct',
        'frequency', 1,
        'max_ads', 3,
        'ad_unit_id', '1000000002'
      ),
      'event_hub', jsonb_build_object(
        'enabled', true,
        'provider', 'direct',
        'frequency', 1,
        'max_ads', 5,
        'ad_unit_id', '1000000003'
      ),
      'event_details', jsonb_build_object(
        'enabled', false,
        'provider', 'direct',
        'frequency', 1,
        'max_ads', 2,
        'ad_unit_id', '1000000004'
      )
    )
  ),
  'Centralized multi-provider advertisement system configuration for LPU Events',
  (select id from public.admin_users where is_active = true order by created_at asc limit 1)
)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();
