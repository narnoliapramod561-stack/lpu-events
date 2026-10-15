# LPU Events — Image Delivery Cost and Cache Architecture Review

**Status:** Architecture audit / blockers for implementation  
**Review branch:** `architecture/native-android-app`  
**Scope:** Existing Student Website, Admin media upload pipeline, Cloudflare R2, and proposed native Android app  
**Decision:** Retain Cloudflare R2 Standard as the public media origin; harden the upload/delivery paths before relying on it for production.

## Executive answer

There are two different meanings of “100% free image delivery”:

1. **Image bandwidth / internet egress cost:** Cloudflare R2 charges **$0 for internet egress, with no egress quota**. That remains true on an R2 cache miss as well as a cache hit, and it is not limited to 10 GB of downloads. The 10 GB free allowance is storage, not delivered image bandwidth. R2's documented free Standard allowance is 10 GB-month storage, 1 million Class A operations and 10 million Class B operations per month. Operations/storage above those allowances are billable. [Official R2 pricing](https://developers.cloudflare.com/r2/pricing/)
2. **Every part of the image system's invoice always being exactly $0 under any traffic:** R2 alone cannot guarantee this. It has usage-based storage/operation billing beyond included amounts. A cache-hit target helps control read operations, but it does not create a provider-enforced hard cap on R2 overages.

**Targeted guarantee:** For images delivered directly through the existing `images.lpuevents.live` R2 Standard custom domain, byte-transfer/egress charges are $0. To keep total image infrastructure at $0 in expected 5,000-student use, enforce storage quotas, use immutable URLs and Cloudflare's cache/Tiered Cache, prevent cache-busting, fix all fallback paths, and monitor the usage ceilings. If the business requirement is instead “no possible overage invoice even under arbitrary abuse,” use a finite-quota static-assets delivery model such as Cloudflare Pages and accept its file/build limitations, or explicitly fail closed when its limits are reached. Do not claim that R2's free operation allowances are unlimited.

## Findings: defects in the current design/code path

### P0 — R2 upload success can be reported when no object was uploaded

In `supabase/functions/r2-upload/index.ts`, missing R2 credentials only trigger a warning. The code continues, inserts a `media_assets` record with status `READY` and returns a successful response even though `r2_uploaded` is false. This can create broken public URLs and false readiness.

**Required fix:** if R2 credentials are absent, return a non-success response before inserting the READY record. Set `READY` only after a successful PUT and verification that the object exists with the expected size/checksum/content type. If database registration fails after a successful upload, mark/queue the object for retry or cleanup; do not pretend the operation was fully successful.

Source: [r2-upload Edge Function](https://github.com/narnoliapramod561-stack/lpu-events/blob/main/supabase/functions/r2-upload/index.ts)

### P0 — The shared R2 storage adapter is a success-returning stub

In `packages/shared/src/images/storage.ts`, `CloudflareR2StorageProvider.put()` returns success without uploading the provided bytes. `deleteMany()` similarly reports successful deletion without issuing R2 deletes. Any code path relying on this adapter can produce metadata for a missing object or a phantom deletion.

**Required fix:** implement real server-side signed PUT/DELETE calls with response checking and tests, or make these methods explicitly unsupported/throwing until implemented. Do not use this adapter as evidence that production storage writes work.

Source: [Image storage adapter](https://github.com/narnoliapramod561-stack/lpu-events/blob/main/packages/shared/src/images/storage.ts)

### P0 — An unguarded Supabase Storage fallback breaks the intended media path

In `packages/shared/src/images/uploader.ts`, a failed/unavailable R2 Edge Function is followed by a direct upload to Supabase Storage `media`. The comment describes this as a local/emulated fallback, but the fallback is not restricted to an explicit development configuration. The rest of the helper still builds a URL from the R2 public base URL, so the stored object and published URL can also diverge.

**Required fix:** fail closed in production if the R2 write fails. Permit Supabase Storage fallback only in local development behind an explicit development-only flag and use the matching local URL in that mode. Production uploads must not silently use Supabase Storage, otherwise media delivery could consume Supabase storage/egress quotas or result in broken images.

Source: [Image uploader](https://github.com/narnoliapramod561-stack/lpu-events/blob/main/packages/shared/src/images/uploader.ts)

### P1 — Fallback image URLs bypass LPU Events' controlled CDN path

The shared image URL resolver contains many `images.unsplash.com` fallbacks and returns arbitrary absolute HTTP/HTTPS URLs as-is. The keyword fallback also returns Unsplash URLs. Those images are not served through our R2 custom domain, and query-string variants create separate third-party URLs/cache keys. This prevents us from guaranteeing that all fallback images use the intended first-party delivery path.

**Required fix:** first-party production fallbacks must be bundled with the Student Website/app or uploaded as fixed immutable R2 assets. The web site can use its Cloudflare Pages static assets for local placeholder artwork; the Android app can bundle a small default placeholder drawable. Reject or migrate external legacy media URLs during publication. Do not generate Unsplash URLs in the production fallback path.

Source: [Image URL resolver](https://github.com/narnoliapramod561-stack/lpu-events/blob/main/packages/shared/src/images/url.ts)

### P1 — Responsive URLs appear to be advertised without corresponding uploads

The web helper constructs mobile and tablet URLs when the primary URL contains `_desktop.webp`. However, the upload client sends only `processed.primaryBlob` as `file`, and the current `r2-upload` handler performs a PUT for one object key ending in `_desktop.webp`; metadata lists variants but that is not the same as uploading their binary files. Mobile/tablet URLs can therefore become 404s, causing extra misses and broken image rendering.

**Required fix:** either upload every actual derivative as a separately verified immutable object (with bounded, optimized sizes) or only advertise variants that exist. Verify each variant in a contract test. Never infer image variants from a filename alone.

Sources: [Uploader](https://github.com/narnoliapramod561-stack/lpu-events/blob/main/packages/shared/src/images/uploader.ts), [R2 upload function](https://github.com/narnoliapramod561-stack/lpu-events/blob/main/supabase/functions/r2-upload/index.ts), [Image URL resolver](https://github.com/narnoliapramod561-stack/lpu-events/blob/main/packages/shared/src/images/url.ts)

### P1 — A “HIT” cannot be expected on the first request to a cold cache

The existing setup guide shows `cf-cache-status: HIT` as an expected test response, but a genuinely cold object/location typically gets a `MISS` first, and subsequent eligible requests should become `HIT`. The correct test must make repeated requests and inspect Cloudflare responses/analytics. Do not use a single cold-request check as proof of a working cache.

Source: [Existing R2 image setup guide](https://github.com/narnoliapramod561-stack/lpu-events/blob/main/docs/technical/CLOUDFLARE_R2_SETUP_GUIDE.md)

## Corrected image-delivery architecture

```text
Admin / Organizer uploads an image
        |
        v
Client-side resize/compress + strict output size bounds
        |
        v
Existing Supabase r2-upload Edge Function
(auth, ownership checks, size/type checks)
        |
        v
Cloudflare R2 Standard: lpu-events-images
(immutable object names; correct cache metadata)
        |
        v
https://images.lpuevents.live/<canonical-immutable-key>
        |
        v
Cloudflare WAF / Cache Rules / native cache lock
        |
        +-- HIT / UPDATING: serve from Cloudflare cache
        |
        +-- MISS: Smart Tiered Cache checks upper tier
                       |
                       +-- R2 GET on tier miss (still $0 egress)
        |
        v
Student Website + native Android app
```

**Do not put a Worker, Supabase Storage proxy, image-transformation service, or another metered service in the normal image-viewing path.** A Worker on every image view can consume the shared Workers Free request limit. Images should be served by Cloudflare's native CDN/cache directly from the R2 custom domain.

### Upload and storage policy

- Use the existing `lpu-events-images` R2 bucket in **Standard** storage class only. Do not use Infrequent Access for student images, because it has data retrieval charges despite free egress.
- Store only optimized derivatives required by the UI. Reject uploads that remain over the configured output limit after optimization; do not silently preserve a large source original in the public bucket.
- Use an immutable, content-addressed URL including pipeline version/context/variant. Uploading changed bytes must create a new URL; never overwrite an immutable object.
- Publish database metadata only after all required image files are verified in R2. Mark upload failed if one required derivative is missing.
- Enforce an application storage ceiling with headroom, e.g. stop accepting new media when reconciled Standard-class usage reaches 8 GB-month; alert at 5 GB. Reconcile actual R2 bucket usage with `media_assets` metadata, because database records alone cannot account for orphaned objects.
- Keep Class A write operations and Class B read operations well under the allowances, not at 99%. Initial warning targets: 50% of the relevant monthly allowance. Any target must be checked against all R2 buckets/resources in the account, not just one code path.
- Do not keep duplicate originals in the public bucket. Delete orphaned/replaced variants after a successful migration and retention window; deletion operations are free under the current R2 pricing schedule.
- Do not publish a user-provided arbitrary URL as a first-party object key or cache key.

### CDN and URL policy

- Use the existing public custom domain `images.lpuevents.live`, not the development `r2.dev` URL. Disable the `r2.dev` URL for the production bucket so it cannot bypass the custom-domain WAF/cache configuration.
- Set correct R2 object metadata at upload:
  `Content-Type: image/webp` (matching actual bytes) and
  `Cache-Control: public, max-age=31536000, immutable`.
- Keep all image URLs canonical and queryless. Use different pathnames for mobile/tablet/desktop variants. Reject query strings on this hostname or normalize the cache key only after confirming the application never uses query parameters to transform/authorize images.
- Create a Cache Rule scoped narrowly to `images.lpuevents.live` and approved immutable media paths. Allow caching for GET/HEAD only and block other methods on the public delivery domain. Cloudflare caches common image extensions by default, but the explicit rule and response metadata must be verified together.
- Enable Smart Tiered Cache for the R2 custom domain. Cloudflare's cache lock collapses simultaneous cold requests for the same asset in a single data center; Tiered Cache reduces misses that reach R2 from different locations. This reduces R2 reads but does not make R2 read operations unlimited.
- Use WAF custom rules/rate limits available on the current plan to reject malformed paths, query-string cache busting, unsupported extensions and obviously abusive request patterns before cache/origin. Never assume this can stop every distributed abuse pattern.
- Warm the most likely assets (homepage carousel, hero, common fallback placeholders and top event cards) after publish. Do not prewarm the entire historical library.
- Test the first request as potentially `MISS`; test a second identical URL as `HIT`; then test from the actual website and mobile app. Verify `CF-Cache-Status`, `Cache-Control`, response MIME, exact object existence and the Cloudflare R2 request/usage metrics.

### Image delivery cost semantics

| Metric | Cost policy |
|---|---|
| Bytes delivered from R2 to students | $0 egress under R2 pricing; no 10 GB egress allowance |
| Cloudflare edge cache HIT delivery | $0 R2 egress; no R2 object read is needed for that hit |
| Cloudflare edge MISS / tiered-cache miss | $0 egress, but can consume a billable-after-free R2 Class B read |
| R2 Standard storage | First 10 GB-month included; above that is billable |
| R2 Class A writes | First 1 million/month included; above that is billable |
| R2 Class B reads | First 10 million/month included; above that is billable |
| Supabase Storage image delivery | Prohibited for production public media, to protect the backend egress budget |
| Third-party fallback images | Prohibited in production; use app-bundled or first-party R2/Pages assets |

The egress guarantee depends on serving image bytes directly through R2/custom-domain Cloudflare delivery. If images are instead routed through another metered product or third-party image service, its pricing may apply.

## If “never receive an overage invoice” is a literal requirement

R2's zero-egress guarantee satisfies **delivery bandwidth**, not unlimited storage/operation use. A strict no-overage design needs a finite, fail-closed media budget. The alternative is to publish images as Cloudflare Pages static assets, where requests/bandwidth are free under the documented Free plan, but the plan is capped at 20,000 files per site, 25 MiB per file and 500 builds per month. New uploaded assets would require batched deployments and the app must handle a failed/held publication if a hard asset/build quota is reached. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

This is a real tradeoff: Pages static assets remove per-view R2 Class B reads, but introduce deployment delay and finite asset capacity. Keep the current R2 design unless the owner explicitly prioritizes a hard no-overage service envelope over immediate dynamic media publishing. In either case, do not claim “unlimited zero-cost infrastructure”; state the resource ceilings and stop behavior.

## Mandatory release gates

- [ ] R2 credentials missing → upload fails; no READY media row and no public URL is returned.
- [ ] Production R2 failure → no Supabase Storage fallback.
- [ ] R2 storage adapter performs real upload/delete or is not used.
- [ ] Every advertised desktop/tablet/mobile variant exists, has correct MIME/cache metadata and loads in test.
- [ ] All production fallbacks are first-party and do not hit Unsplash/other third-party image origins.
- [ ] Canonical image URLs have no query strings and use immutable unique keys.
- [ ] Repeated request test shows first cold request may be MISS and subsequent request is HIT; Tiered Cache is enabled and observed.
- [ ] The public R2 bucket is Standard-only, `r2.dev` is disabled, and WAF/cache rules apply to the custom domain.
- [ ] Storage usage is reconciled and new uploads fail closed at the chosen safety budget.
- [ ] Dashboard monitoring exists for storage, Class A and Class B operations; alerts at 50% and operational degradation before allowance exhaustion.
- [ ] 5,000-student load test uses measured image requests/bytes and actual R2 usage, with combined website/app traffic and cache warm/cold scenarios.
- [ ] The documented promise distinguishes guaranteed $0 egress from conditional $0 total storage/operation cost.

## Official references

- R2 pricing and allowances: https://developers.cloudflare.com/r2/pricing/
- R2 public buckets / custom domain / cache behavior: https://developers.cloudflare.com/r2/buckets/public-buckets/
- Enable cache for R2 and Tiered Cache: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- Cloudflare default cache behavior and request collapsing: https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
- Cloudflare Cache Rules: https://developers.cloudflare.com/cache/how-to/cache-rules/create-dashboard/
- Cloudflare Pages plan limits: https://developers.cloudflare.com/pages/platform/limits/
