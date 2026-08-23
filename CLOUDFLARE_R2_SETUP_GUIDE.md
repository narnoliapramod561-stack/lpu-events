# Cloudflare R2 Step-by-Step Production Setup Guide

This guide walks you step-by-step through configuring **Cloudflare R2 Object Storage** and **Cloudflare CDN** for **LPU Events** image delivery.

---

## Architecture Overview

```
[Admin Web Upload] ──▶ [Supabase Edge Function: r2-upload] ──▶ [Cloudflare R2 Bucket]
                                                                        │
[Student / Public] ◀── [Cloudflare CDN: images.lpuevents.live] ◀────────┘
```

- **R2 Bucket Name**: `lpu-events-images`
- **Public Delivery Domain**: `https://images.lpuevents.live`
- **Security Rule**: Zero R2 API tokens in frontend code. Server-side validation and signed upload only.

---

## Step 1: Log in & Enable Cloudflare R2

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. On the left sidebar navigation, select **R2** (or **Storage & Databases** → **R2**).
3. If this is your first time using R2:
   - Click **Enable R2**.
   - Review and agree to the terms (Cloudflare offers 10 GB/month free storage and zero egress fees).

---

## Step 2: Create the Dedicated R2 Bucket

1. In the **R2 Overview** page, click the blue **Create bucket** button.
2. Enter the Bucket details:
   - **Bucket Name**: `lpu-events-images`
   - **Location**: Select **Automatic** (or **APAC** / **WNAM** depending on primary traffic proximity).
   - **Default Storage Class**: **Standard**
3. Click **Create Bucket**.

---

## Step 3: Connect Custom Domain for Free CDN Delivery

Connecting a custom domain provides global CDN caching, SSL certificates, and zero egress fees.

1. In your `lpu-events-images` bucket page, click the **Settings** tab at the top.
2. Scroll down to the **Public access** section.
3. Under **Custom Domains**, click **Connect Domain**.
4. Enter your public image subdomain:
   ```
   images.lpuevents.live
   ```
5. Click **Continue**.
6. Cloudflare will show the DNS record to be created (e.g. CNAME pointing to R2). Click **Connect Domain** / **Confirm**.
7. Status will show **Active** with an SSL/TLS certificate automatically provisioned.

---

## Step 4: Configure CORS (Cross-Origin Resource Sharing)

CORS allows your web applications (`lpuevents.live` and `admin.lpuevents.live`) to safely display and upload assets.

1. In the bucket **Settings** tab, scroll to **CORS Policy**.
2. Click **Add CORS policy** (or **Edit CORS policy**).
3. Paste the following JSON policy:

```json
[
  {
    "AllowedOrigins": [
      "https://lpuevents.live",
      "https://admin.lpuevents.live",
      "https://*.lpuevents.live",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8081"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT",
      "DELETE"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Type",
      "Content-Length",
      "Cache-Control"
    ],
    "MaxAgeSeconds": 86400
  }
]
```

4. Click **Save**.

---

## Step 5: Generate R2 API Tokens (Backend Secrets)

To allow the server-side Supabase Edge Functions and migration scripts to write/delete objects, create an API token with minimum required permissions.

1. Go back to the main **R2 Overview** page (`https://dash.cloudflare.com/?to=/:account/r2`).
2. In the right-hand panel, click **Manage R2 API Tokens**.
3. Click **Create API token**.
4. Configure the token settings:
   - **Token Name**: `lpu-events-r2-backend-token`
   - **Permissions**: Select **Object Read & Write** (allows `PutObject`, `GetObject`, `DeleteObject`).
   - **Apply to specific buckets only**: Select `lpu-events-images`.
   - **TTL / Expiry**: Set according to your security policy (or leave indefinite for production service account).
5. Click **Create API Token**.
6. **IMPORTANT**: Copy and securely save the generated credentials immediately (they will not be shown again):
   - **Account ID** (found in URL or token screen)
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint URL**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

---

## Step 6: Configure Server-Side Secrets in Supabase

Add the R2 credentials to your Supabase project secrets so the `r2-upload` Edge Function can authenticate with R2.

### Option A: Using Supabase CLI (Recommended)
Run the following command from your terminal:

```bash
supabase secrets set \
  R2_ACCOUNT_ID="your-cloudflare-account-id" \
  R2_ACCESS_KEY_ID="your-access-key-id" \
  R2_SECRET_ACCESS_KEY="your-secret-access-key" \
  R2_BUCKET_NAME="lpu-events-images" \
  VITE_R2_PUBLIC_URL="https://images.lpuevents.live"
```

### Option B: Using Supabase Dashboard
1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Go to **Project Settings** → **Edge Functions** → **Secrets**.
3. Add the following secrets:
   - `R2_ACCOUNT_ID`: `<your-cloudflare-account-id>`
   - `R2_ACCESS_KEY_ID`: `<your-access-key-id>`
   - `R2_SECRET_ACCESS_KEY`: `<your-secret-access-key>`
   - `R2_BUCKET_NAME`: `lpu-events-images`
   - `VITE_R2_PUBLIC_URL`: `https://images.lpuevents.live`

---

## Step 7: Configure Frontend & Worker Environment Variables

### Frontend Client Environment (`.env` in `apps/admin-web` & `apps/student-web`)
Only the public delivery CDN URL is exposed to client code:

```env
VITE_R2_PUBLIC_URL=https://images.lpuevents.live
```

### Server / Background Worker Environment (`scripts/.env` or production server env)

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=lpu-events-images
VITE_R2_PUBLIC_URL=https://images.lpuevents.live
```

---

## Step 8: Deploy Supabase Database Migrations & Edge Functions

1. **Deploy Database Migration**:
   ```bash
   supabase db push
   ```
   *(Applies `20260824000002_cloudflare_r2_storage_hardening.sql`)*

2. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy r2-upload --no-verify-jwt=false
   supabase functions deploy r2-storage --no-verify-jwt=false
   ```

---

## Step 9: Migrate Existing Images to Cloudflare R2

Run the migration script to safely transfer all existing event banners, posters, memories, and partner logos to R2 without deleting original storage:

1. **Dry-Run Mode (Simulation & Validation)**:
   ```bash
   npm run migrate:images-to-r2 -- --dry-run
   ```

2. **Live Production Migration**:
   ```bash
   npm run migrate:images-to-r2
   ```

3. **Verify CDN Availability Only**:
   ```bash
   npm run migrate:images-to-r2 -- --verify-only
   ```

---

## Step 10: Verification & Testing

### 1. Test Admin Event Banner Upload
1. Log into **LPU Events Admin Portal** (`https://admin.lpuevents.live` or `http://localhost:5173`).
2. Go to **Create Event Wizard** (`/events/create`).
3. Upload a sample banner image (`.jpg` or `.png`).
4. Verify the 4-stage upload progress bar:
   - *Validating format & magic bytes...*
   - *Enhancing fidelity & typography...*
   - *Generating WebP responsive variants...*
   - *Storing into Cloudflare R2...*
5. Verify preview loads with green badge: `HD WebP • Saved XX% (YY KB)`.

### 2. Test CDN URL & Edge Caching
In your terminal, test the public CDN delivery and headers:

```bash
curl -I https://images.lpuevents.live/optimized/event-banner/v1/..._desktop.webp
```

Expected Response Headers:
```http
HTTP/2 200
content-type: image/webp
cache-control: public, max-age=31536000, immutable
cf-cache-status: HIT
```

---

## Step 11: Run the Background Physical Cleanup Worker

To automatically purge deleted/replaced image objects from Cloudflare R2 in the background:

```bash
# Run in continuous polling loop
npm run worker:r2-cleanup

# Or run single batch
npx tsx --env-file=.env scripts/r2_cleanup_worker.ts --batch=50
```

---

## Troubleshooting & FAQ

### Q: Why do I get a CORS error on `images.lpuevents.live`?
**A**: Ensure your custom domain is connected in the bucket settings and the CORS policy from **Step 4** has been saved in the `lpu-events-images` bucket.

### Q: Why does the upload return 401 Unauthorized?
**A**: Ensure the user has an active Admin or Organizer session. Organizers can only upload banners for events belonging to their assigned organization.

### Q: Why are SVG or executable files rejected?
**A**: The server performs binary magic byte inspection. Vector SVGs, HTML files, and scripts are strictly rejected to prevent Stored XSS and active content injection attacks.
