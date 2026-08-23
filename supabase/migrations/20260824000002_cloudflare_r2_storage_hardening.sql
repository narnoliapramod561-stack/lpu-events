-- ==============================================================================
-- 20260824000002_cloudflare_r2_storage_hardening.sql
-- Database Migration: Cloudflare R2 Production Object Storage, Ownership Guardrails,
--                     Canonical Key Namespaces, and Lifecycle Hardening
-- ==============================================================================

-- 1. Ensure media_assets has bucket configured for R2 production default
alter table public.media_assets
alter column bucket set default 'lpu-events-images';

-- 2. Enhanced request_media_upload RPC with R2 support and Organizer Isolation
create or replace function public.request_media_upload(
  p_media_type text,
  p_mime_type text,
  p_file_size_bytes integer,
  p_width integer default null,
  p_height integer default null,
  p_context text default null,
  p_checksum text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_entity_id uuid default null
)
returns json security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid;
  v_admin_role text;
  v_admin_org_id uuid;
  v_media_id uuid;
  v_bucket text := 'lpu-events-images';
  v_object_key text;
  v_upload_url text;
  v_hash_prefix text;
  v_context text;
begin
  -- 1. Authenticate user
  if auth.uid() is null then
    return public.set_api_error(401, 'UNAUTHENTICATED', 'Administrative session required.');
  end if;

  select id, role::text, org_id into v_admin_id, v_admin_role, v_admin_org_id
  from public.admin_users
  where auth_user_id = auth.uid() and is_active = true;

  if v_admin_id is null then
    return public.set_api_error(403, 'UNAUTHORIZED', 'No active administrative profile found.');
  end if;

  -- 2. Strict file size validation (max 10MB = 10,485,760 bytes)
  if p_file_size_bytes is null or p_file_size_bytes <= 0 then
    return public.set_api_error(400, 'INVALID_FILE_SIZE', 'File size must be greater than 0 bytes.');
  end if;

  if p_file_size_bytes > 10485760 then
    return public.set_api_error(400, 'FILE_TOO_LARGE', 'The file size exceeds the maximum allowed limit of 10MB.');
  end if;

  -- 3. Strict MIME type validation (Allowed raster & modern formats; reject SVGs/HTML/Executables)
  if p_mime_type not in ('image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif') then
    return public.set_api_error(400, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG, WebP, and AVIF images are permitted.');
  end if;

  -- 4. Media type enum validation
  if p_media_type not in ('EVENT_BANNER', 'SPONSOR_LOGO', 'CAROUSEL_IMAGE', 'MEMORY_IMAGE', 'ADVERTISEMENT') then
    return public.set_api_error(400, 'INVALID_MEDIA_TYPE', 'Invalid media type category.');
  end if;

  -- 5. Organizer Dual-Check Ownership Validation:
  -- If an organizer is uploading for an existing event/entity, verify they own that entity
  if v_admin_role = 'ORGANIZER' then
    -- Non-super admins cannot upload platform-wide Ads or Sponsor Logos
    if p_media_type in ('ADVERTISEMENT', 'SPONSOR_LOGO') then
      return public.set_api_error(403, 'FORBIDDEN', 'Only Super Administrators can manage platform advertisements and sponsor logos.');
    end if;

    if p_entity_id is not null then
      if not exists (
        select 1 from public.events
        where id = p_entity_id and organization_id = v_admin_org_id
      ) then
        return public.set_api_error(403, 'ORGANIZATION_MISMATCH', 'Organizers can only manage media assets for their own events.');
      end if;
    end if;
  end if;

  -- 6. Canonical R2 Object Key Generation
  v_context := lower(trim(coalesce(p_context, 'event-banner')));
  v_media_id := gen_random_uuid();

  if p_checksum is not null and length(trim(p_checksum)) >= 8 then
    v_hash_prefix := substring(trim(p_checksum) from 1 for 4);
    v_object_key := 'optimized/' || v_context || '/v1/' || v_hash_prefix || '/' || trim(p_checksum) || '_desktop.webp';
  else
    v_object_key := 'uploads/' || v_context || '/v1/' || v_media_id::text || '.webp';
  end if;

  -- 7. Insert or resolve media asset record with R2 bucket namespace
  insert into public.media_assets (
    id,
    bucket,
    object_key,
    media_type,
    mime_type,
    file_size_bytes,
    width,
    height,
    checksum,
    context,
    metadata,
    status,
    created_by
  ) values (
    v_media_id,
    v_bucket,
    v_object_key,
    p_media_type::public.media_type,
    p_mime_type,
    p_file_size_bytes,
    p_width,
    p_height,
    p_checksum,
    v_context,
    coalesce(p_metadata, '{}'::jsonb),
    'UPLOADING',
    v_admin_id
  )
  on conflict (bucket, object_key) do update
  set updated_at = now()
  returning id, object_key into v_media_id, v_object_key;

  v_upload_url := 'https://images.lpuevents.live/' || v_object_key;

  return json_build_object(
    'media_id', v_media_id,
    'bucket', v_bucket,
    'object_key', v_object_key,
    'public_url', v_upload_url,
    'method', 'PUT',
    'headers', jsonb_build_object(
      'Content-Type', 'image/webp',
      'Cache-Control', 'public, max-age=31536000, immutable'
    )
  );
end;
$$ language plpgsql;

-- 3. Confirm Media Upload RPC
create or replace function public.confirm_media_upload(
  p_media_id uuid
)
returns json security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid;
  v_asset record;
begin
  if auth.uid() is null then
    return public.set_api_error(401, 'UNAUTHENTICATED', 'Administrative session required.');
  end if;

  select id into v_admin_id from public.admin_users where auth_user_id = auth.uid() and is_active = true;
  if v_admin_id is null then
    return public.set_api_error(403, 'UNAUTHORIZED', 'No active administrative profile found.');
  end if;

  select * into v_asset from public.media_assets where id = p_media_id;
  if v_asset.id is null then
    return public.set_api_error(404, 'MEDIA_NOT_FOUND', 'Target media asset does not exist.');
  end if;

  update public.media_assets
  set status = 'READY',
      verified_at = now(),
      updated_at = now()
  where id = p_media_id;

  return json_build_object(
    'success', true,
    'media_id', p_media_id,
    'status', 'READY',
    'object_key', v_asset.object_key,
    'public_url', 'https://images.lpuevents.live/' || v_asset.object_key
  );
end;
$$ language plpgsql;

grant execute on function public.request_media_upload(text, text, integer, integer, integer, text, text, jsonb, uuid) to authenticated;
grant execute on function public.confirm_media_upload(uuid) to authenticated;
