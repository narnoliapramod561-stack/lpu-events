// supabase/functions/r2-upload/index.ts
// LPU Events — Cloudflare R2 Authenticated Server-Side Upload Edge Function
// Handles: Session Auth, Organizer Dual-Check Isolation, Magic Byte Verification,
// S3 API via AWS SigV4 to Cloudflare R2, and Canonical PostgreSQL Registration.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-custom-metadata",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Content-Type": "application/json",
};

// --- AWS Signature V4 S3 Client for Cloudflare R2 ---
interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function uploadToR2(
  config: R2Config,
  key: string,
  data: Uint8Array,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable"
): Promise<{ success: boolean; error?: string }> {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${config.bucketName}/${key.replace(/^\/+/, "")}`;
  const now = new Date();
  const dateIso = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateShort = dateIso.substring(0, 8); // YYYYMMDD
  const region = "auto";
  const service = "s3";

  const payloadHash = await sha256Hex(data);

  // Headers for signing
  const canonicalHeaders = [
    `cache-control:${cacheControl}`,
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${dateIso}`,
  ].join("\n") + "\n";

  const signedHeaders = "cache-control;content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    `/${config.bucketName}/${key.replace(/^\/+/, "")}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));

  const credentialScope = `${dateShort}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateIso,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  // Derive signing key
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${config.secretAccessKey}`), dateShort);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signatureBuffer = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Host": host,
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": dateIso,
        "Authorization": authHeader,
      },
      body: data,
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `R2 PUT error ${response.status}: ${errText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reach Cloudflare R2 endpoint" };
  }
}

// --- Binary Magic Byte Sniffing ---
function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }

  // WebP: RIFF ... WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  // AVIF: ftypavif or ftypavis
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "avif" || brand === "avis" || brand === "mif1") {
      return "image/avif";
    }
  }

  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization bearer token." }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Authenticate user session
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);

  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired administrative session." }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  // 2. Fetch admin user profile & role
  const { data: adminUser, error: adminErr } = await supabase
    .from("admin_users")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (adminErr || !adminUser || !adminUser.is_active) {
    return new Response(JSON.stringify({ error: "Unauthorized: Active administrative account required." }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  // Check platform admin role
  const { data: platformRole } = await supabase
    .from("platform_admin_roles")
    .select("role")
    .eq("admin_user_id", adminUser.id)
    .maybeSingle();

  const isSuperAdmin = platformRole?.role === "SUPER_ADMIN";

  // Check organizer profile
  const { data: orgProfile } = await supabase
    .from("organizer_profiles")
    .select("organization_id")
    .eq("admin_user_id", adminUser.id)
    .maybeSingle();

  const isOrganizer = !!orgProfile && !isSuperAdmin;
  const organizerOrgId = orgProfile?.organization_id;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const context = (formData.get("context") as string || "event-banner").toLowerCase();
    const entityId = formData.get("entity_id") as string | null;
    const clientChecksum = formData.get("checksum") as string | null;
    const customMetadataStr = formData.get("metadata") as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No image file provided in form-data." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 3. File size limit (10MB)
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    if (fileBytes.length === 0) {
      return new Response(JSON.stringify({ error: "Image file is empty." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (fileBytes.length > 10485760) {
      return new Response(JSON.stringify({ error: "File exceeds 10MB maximum limit." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 4. Validate binary magic bytes (Sniffing)
    const detectedMime = detectMimeType(fileBytes);
    if (!detectedMime) {
      return new Response(JSON.stringify({ error: "Unsupported image format. Allowed formats: JPEG, PNG, WebP, AVIF." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 5. Dual-Check Organizer Ownership
    if (isOrganizer) {
      if (context === "advertisement" || context === "sponsor-logo") {
        return new Response(JSON.stringify({ error: "Organizers cannot modify platform ads or sponsor assets." }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      if (entityId) {
        const { data: eventRow } = await supabase
          .from("events")
          .select("id, organization_id")
          .eq("id", entityId)
          .maybeSingle();

        if (eventRow && eventRow.organization_id !== organizerOrgId) {
          return new Response(JSON.stringify({ error: "Forbidden: You cannot modify images for another organization's event." }), {
            status: 403,
            headers: corsHeaders,
          });
        }
      }
    }

    // 6. Generate canonical checksum & key
    const checksum = clientChecksum || (await sha256Hex(fileBytes));
    const hashPrefix = checksum.substring(0, 4);
    const mediaId = crypto.randomUUID();
    const objectKey = `optimized/${context}/v1/${hashPrefix}/${checksum}_desktop.webp`;
    const bucketName = Deno.env.get("R2_BUCKET_NAME") || "lpu-events-images";

    // 7. Cloudflare R2 Upload
    const r2AccountId = Deno.env.get("R2_ACCOUNT_ID");
    const r2AccessKey = Deno.env.get("R2_ACCESS_KEY_ID");
    const r2SecretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");

    let r2UploadSuccess = false;
    if (r2AccountId && r2AccessKey && r2SecretKey) {
      const r2Result = await uploadToR2(
        {
          accountId: r2AccountId,
          accessKeyId: r2AccessKey,
          secretAccessKey: r2SecretKey,
          bucketName,
        },
        objectKey,
        fileBytes,
        detectedMime
      );

      if (!r2Result.success) {
        console.error("R2 Upload Error:", r2Result.error);
        return new Response(JSON.stringify({ error: "Cloudflare R2 upload failed: " + r2Result.error }), {
          status: 502,
          headers: corsHeaders,
        });
      }
      r2UploadSuccess = true;
    } else {
      console.warn("R2 credentials not set in Edge Function; proceeding with database metadata registration.");
    }

    // 8. Register in PostgreSQL media_assets table
    const publicDomain = Deno.env.get("VITE_R2_PUBLIC_URL") || "https://images.lpuevents.live";
    const publicUrl = `${publicDomain.replace(/\/+$/, "")}/${objectKey}`;

    let parsedMetadata = {};
    if (customMetadataStr) {
      try {
        parsedMetadata = JSON.parse(customMetadataStr);
      } catch {}
    }

    const { data: mediaAsset, error: dbErr } = await supabase
      .from("media_assets")
      .insert({
        id: mediaId,
        bucket: bucketName,
        object_key: objectKey,
        media_type: context === "hero" ? "CAROUSEL_IMAGE" : context === "sponsor-logo" ? "SPONSOR_LOGO" : context === "advertisement" ? "ADVERTISEMENT" : context === "memory" ? "MEMORY_IMAGE" : "EVENT_BANNER",
        mime_type: detectedMime,
        file_size_bytes: fileBytes.length,
        checksum,
        context,
        metadata: {
          ...parsedMetadata,
          r2_uploaded: r2UploadSuccess,
          pipeline_version: 1,
        },
        status: "READY",
        created_by: adminUser.id,
        verified_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (dbErr) {
      return new Response(JSON.stringify({ error: "Failed to persist media asset in database: " + dbErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        media_id: mediaAsset.id,
        object_key: mediaAsset.object_key,
        public_url: publicUrl,
        file_size_bytes: fileBytes.length,
        mime_type: detectedMime,
        checksum,
        context,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error during upload." }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
