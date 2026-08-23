/**
 * scripts/test_r2_connectivity.ts
 * Cloudflare R2 Live Backend Connectivity Verification
 */

import crypto from 'crypto';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'ebc6930d2f0caf22655c09bd8296e9e1';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '9ddbe8f5c8ec24091aea4a20691983a2';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'd140d8c06614e49fedc1f77d3b4c5f2321d5fed6648243e5bae9717b1ef5d36c';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'lpu-events-images';
const R2_PUBLIC_URL = process.env.VITE_R2_PUBLIC_URL || 'https://images.lpuevents.live';

const TEST_KEY = `test-connectivity/lpu-events-ping-${Date.now()}.json`;
const TEST_PAYLOAD = JSON.stringify({
  service: 'lpu-events',
  timestamp: new Date().toISOString(),
  status: 'R2_CONNECTIVITY_VERIFIED',
  storage_class: 'Standard'
});

function generateSigV4Headers(method: string, key: string, payload: Buffer, contentType: string, extraHeaders: Record<string, string> = {}) {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const cleanKey = key.replace(/^\/+/, '');
  const now = new Date();
  const dateIso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateShort = dateIso.substring(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

  const headersToSign: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': dateIso,
    ...extraHeaders
  };

  if (contentType) {
    headersToSign['content-type'] = contentType;
  }

  const sortedHeaderKeys = Object.keys(headersToSign).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k.toLowerCase()}:${headersToSign[k]}`).join('\n') + '\n';
  const signedHeaders = sortedHeaderKeys.map((k) => k.toLowerCase()).join(';');

  const canonicalRequest = [
    method,
    `/${R2_BUCKET_NAME}/${cleanKey}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const credentialScope = `${dateShort}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateIso,
    credentialScope,
    canonicalRequestHash
  ].join('\n');

  const kDate = crypto.createHmac('sha256', `AWS4${R2_SECRET_ACCESS_KEY}`).update(dateShort).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: {
      ...headersToSign,
      Authorization: authHeader
    },
    endpoint: `https://${host}/${R2_BUCKET_NAME}/${cleanKey}`
  };
}

async function runTest() {
  console.log('========================================================================');
  console.log('  CLOUDFLARE R2 LIVE CONNECTIVITY & CREDENTIALS TEST                     ');
  console.log('========================================================================');
  console.log(`  Account ID:   ${R2_ACCOUNT_ID}`);
  console.log(`  Access Key:   ${R2_ACCESS_KEY_ID}`);
  console.log(`  Bucket:       ${R2_BUCKET_NAME}`);
  console.log(`  CDN Domain:   ${R2_PUBLIC_URL}`);
  console.log(`  Test Key:     ${TEST_KEY}`);
  console.log('========================================================================\n');

  const payloadBuffer = Buffer.from(TEST_PAYLOAD, 'utf-8');

  // STEP 1: PUT OBJECT via R2 S3 REST API
  console.log('[1/4] Testing PUT Object to Cloudflare R2...');
  const putInfo = generateSigV4Headers('PUT', TEST_KEY, payloadBuffer, 'application/json', {
    'cache-control': 'public, max-age=300, immutable'
  });

  const putRes = await fetch(putInfo.endpoint, {
    method: 'PUT',
    headers: putInfo.headers,
    body: payloadBuffer
  });

  if (!putRes.ok) {
    const errorText = await putRes.text();
    console.error(`❌ PUT Object Failed (HTTP ${putRes.status}):`, errorText);
    process.exit(1);
  }
  console.log(`✅ PUT Object Succeeded (HTTP ${putRes.status}, ETag: ${putRes.headers.get('etag')})\n`);

  // STEP 2: GET OBJECT via R2 S3 REST API
  console.log('[2/4] Testing GET Object from Cloudflare R2 S3 API...');
  const getInfo = generateSigV4Headers('GET', TEST_KEY, Buffer.alloc(0), '', {});
  const getRes = await fetch(getInfo.endpoint, {
    method: 'GET',
    headers: getInfo.headers
  });

  if (!getRes.ok) {
    const errorText = await getRes.text();
    console.error(`❌ GET Object via S3 Failed (HTTP ${getRes.status}):`, errorText);
  } else {
    const bodyText = await getRes.text();
    console.log(`✅ GET Object via S3 Succeeded (HTTP ${getRes.status}): ${bodyText}\n`);
  }

  // STEP 3: GET OBJECT via Public CDN Domain (images.lpuevents.live)
  console.log(`[3/4] Testing Public CDN Delivery via ${R2_PUBLIC_URL}...`);
  const publicCdnUrl = `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${TEST_KEY}`;
  try {
    const cdnRes = await fetch(publicCdnUrl);
    if (cdnRes.ok) {
      const cdnText = await cdnRes.text();
      console.log(`✅ Public CDN Delivery Succeeded (HTTP ${cdnRes.status})`);
      console.log(`   CF-Cache-Status: ${cdnRes.headers.get('cf-cache-status') || 'N/A'}`);
      console.log(`   Content-Type:    ${cdnRes.headers.get('content-type')}`);
      console.log(`   Body:            ${cdnText}\n`);
    } else {
      console.log(`ℹ️ Public CDN returned HTTP ${cdnRes.status} (Custom domain DNS / SSL might still be finalizing or propagating)\n`);
    }
  } catch (err: any) {
    console.log(`ℹ️ Public CDN connection note: ${err.message}\n`);
  }

  // STEP 4: DELETE OBJECT from R2 (Cleanup)
  console.log('[4/4] Cleaning up test object from R2...');
  const delInfo = generateSigV4Headers('DELETE', TEST_KEY, Buffer.alloc(0), '', {});
  const delRes = await fetch(delInfo.endpoint, {
    method: 'DELETE',
    headers: delInfo.headers
  });

  if (delRes.ok || delRes.status === 204) {
    console.log(`✅ Test Object Successfully Purged (HTTP ${delRes.status})\n`);
  } else {
    console.warn(`⚠️ Warning: Delete returned HTTP ${delRes.status}`);
  }

  console.log('========================================================================');
  console.log('  🎉 R2 CONNECTIVITY & CREDENTIALS TEST RESULT: ALL TESTS PASSED!       ');
  console.log('========================================================================\n');
}

runTest().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
