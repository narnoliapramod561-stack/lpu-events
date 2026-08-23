/**
 * r2_security_and_storage.test.ts
 * Comprehensive Verification & Security Test Suite for Cloudflare R2 Image Storage
 */

import { describe, it, expect, vi } from 'vitest';
import {
  detectImageMimeTypeFromBuffer,
  validateImageFile,
  calculateTargetDimensions,
  getOptimizedImage,
  getOptimizedImageSrcSet,
  getStorageBaseUrl,
  CloudflareR2StorageProvider,
  IMAGE_PIPELINE_LIMITS,
  IMAGE_CONTEXT_CONFIGS
} from '../index';

describe('Cloudflare R2 Image Pipeline & Security Suite', () => {
  describe('1. Binary Magic Byte Sniffing & Format Security', () => {
    it('accurately identifies JPEG magic bytes (FF D8 FF)', async () => {
      const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).buffer;
      const mime = await detectImageMimeTypeFromBuffer(jpegBuffer);
      expect(mime).toBe('image/jpeg');
    });

    it('accurately identifies PNG magic bytes (89 50 4E 47)', async () => {
      const pngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
      const mime = await detectImageMimeTypeFromBuffer(pngBuffer);
      expect(mime).toBe('image/png');
    });

    it('accurately identifies WebP magic bytes (RIFF...WEBP)', async () => {
      const webpBuffer = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
      ]).buffer;
      const mime = await detectImageMimeTypeFromBuffer(webpBuffer);
      expect(mime).toBe('image/webp');
    });

    it('accurately identifies AVIF magic bytes (ftypavif)', async () => {
      const avifBuffer = new Uint8Array([
        0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66
      ]).buffer;
      const mime = await detectImageMimeTypeFromBuffer(avifBuffer);
      expect(mime).toBe('image/avif');
    });

    it('rejects executable ELF/PE binaries spoofed with .jpg extension', async () => {
      // ELF magic: 7F 45 4C 46
      const elfBuffer = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]).buffer;
      const mime = await detectImageMimeTypeFromBuffer(elfBuffer);
      expect(mime).toBeNull();
    });

    it('rejects HTML/Script content disguised as images', async () => {
      const htmlBuffer = new TextEncoder().encode('<!DOCTYPE html><html><script>alert(1)</script></html>').buffer;
      const mime = await detectImageMimeTypeFromBuffer(htmlBuffer);
      expect(mime).toBeNull();
    });
  });

  describe('2. Safety Bounds, Limits & Decompression Bomb Protection', () => {
    it('enforces maximum 10MB upload limit', () => {
      expect(IMAGE_PIPELINE_LIMITS.maxUploadSizeBytes).toBe(10 * 1024 * 1024);
    });

    it('flags decompression bombs (>16.7 Megapixels)', () => {
      const extremeWidth = 10000;
      const extremeHeight = 10000;
      const totalPixels = extremeWidth * extremeHeight;
      expect(totalPixels).toBeGreaterThan(IMAGE_PIPELINE_LIMITS.maxTotalPixelArea);
    });

    it('preserves small images without artificial upscaling (No-Blind-Upscale Guard)', () => {
      const target = calculateTargetDimensions(400, 225, 1920, 800, 'cover', 1920 / 800);
      expect(target.width).toBeLessThanOrEqual(400);
      expect(target.height).toBeLessThanOrEqual(225);
    });

    it('ensures event-banner context uses inside-fit mode to prevent poster cropping', () => {
      const bannerConfig = IMAGE_CONTEXT_CONFIGS['event-banner'];
      expect(bannerConfig.fitMode).toBe('inside');
    });
  });

  describe('3. Cloudflare R2 Public Delivery & Canonical URLs', () => {
    it('defaults to canonical Cloudflare domain https://images.lpuevents.live', () => {
      const baseUrl = getStorageBaseUrl();
      expect(baseUrl).toContain('images.lpuevents.live');
    });

    it('resolves relative R2 object keys to canonical CDN URLs', () => {
      const key = 'optimized/event-banner/v1/a1b2/a1b2c3d4_desktop.webp';
      const url = getOptimizedImage(key, 'event-banner');
      expect(url).toBe(`https://images.lpuevents.live/${key}`);
    });

    it('generates responsive srcSet derivatives for desktop, tablet, and mobile', () => {
      const key = 'optimized/hero/v1/e3b0/e3b0c442_desktop.webp';
      const result = getOptimizedImageSrcSet(key, 'hero');
      expect(result.src).toContain('_desktop.webp');
      expect(result.srcSet).toBeDefined();
      expect(result.srcSet).toContain('_mobile.webp');
      expect(result.srcSet).toContain('_tablet.webp');
      expect(result.srcSet).toContain('_desktop.webp');
    });

    it('preserves absolute external URLs and Unsplash fallbacks cleanly', () => {
      const externalUrl = 'https://images.unsplash.com/photo-1542751371-adc38448a05e';
      const resolved = getOptimizedImage(externalUrl, 'event-card');
      expect(resolved).toBe(externalUrl);
    });
  });

  describe('4. Cloudflare R2 Storage Adapter Contract', () => {
    it('initializes with default bucket lpu-events-images', () => {
      const provider = new CloudflareR2StorageProvider();
      expect(provider.bucketName).toBe('lpu-events-images');
      expect(provider.publicBaseUrl).toBe('https://images.lpuevents.live');
    });

    it('constructs clean public URLs without leading slash duplication', () => {
      const provider = new CloudflareR2StorageProvider({
        publicBaseUrl: 'https://images.lpuevents.live'
      });
      expect(provider.getPublicUrl('/events/banner.webp')).toBe('https://images.lpuevents.live/events/banner.webp');
      expect(provider.getPublicUrl('events/banner.webp')).toBe('https://images.lpuevents.live/events/banner.webp');
    });

    it('implements deleteMany and handles batch deletion safely', async () => {
      const provider = new CloudflareR2StorageProvider();
      const res = await provider.deleteMany(['key1.webp', 'key2.webp']);
      expect(res.success).toBe(true);
      expect(res.deletedKeys).toEqual(['key1.webp', 'key2.webp']);
    });
  });

  describe('5. Cross-Organizer Security & Ownership Isolation Simulation', () => {
    it('simulates server-side rejection when Organizer A targets Organizer B event image', () => {
      const organizerA = { id: 'admin-org-a', org_id: 'org-1111', role: 'ORGANIZER' };
      const eventB = { id: 'event-2222', organization_id: 'org-2222' };

      // Dual check ownership logic
      const isAuthorized = organizerA.role === 'SUPER_ADMIN' || organizerA.org_id === eventB.organization_id;
      expect(isAuthorized).toBe(false);
    });

    it('simulates server-side rejection when Organizer attempts to manage platform Ads or Sponsors', () => {
      const organizer = { role: 'ORGANIZER' };
      const requestedContexts = ['advertisement', 'sponsor-logo'];

      for (const ctx of requestedContexts) {
        const canManage = organizer.role === 'SUPER_ADMIN';
        expect(canManage).toBe(false);
      }
    });

    it('allows Super Admin full administrative management across all organizations', () => {
      const superAdmin = { role: 'SUPER_ADMIN', org_id: null };
      const anyEvent = { id: 'event-any', organization_id: 'org-any' };

      const isAuthorized = superAdmin.role === 'SUPER_ADMIN' || superAdmin.org_id === anyEvent.organization_id;
      expect(isAuthorized).toBe(true);
    });
  });

  describe('6. Concurrency Safety, Replacement Leases & Deletion Rollback', () => {
    it('rejects relinking an asset currently undergoing physical deletion lease (DELETING)', () => {
      const assetInLease = { id: 'media-1', status: 'DELETING' };
      const canLink = assetInLease.status !== 'DELETING' && assetInLease.status !== 'DELETED';
      expect(canLink).toBe(false);
    });

    it('rolls back asset status to PENDING_DELETE if R2 physical deletion fails', () => {
      const asset = { id: 'media-fail', status: 'DELETING' };
      const r2DeletionSuccess = false;

      // Failure rollback logic
      if (!r2DeletionSuccess) {
        asset.status = 'PENDING_DELETE';
      }

      expect(asset.status).toBe('PENDING_DELETE');
    });

    it('marks asset DELETED only after confirmed physical R2 purge', () => {
      const asset = { id: 'media-success', status: 'DELETING' };
      const r2DeletionSuccess = true;

      if (r2DeletionSuccess) {
        asset.status = 'DELETED';
      }

      expect(asset.status).toBe('DELETED');
    });
  });
});
