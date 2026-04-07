/**
 * LemonSqueezy License Key Validation Service
 *
 * Handles license activation, validation, and deactivation
 * using the LemonSqueezy License API (no API key required).
 *
 * API Docs: https://docs.lemonsqueezy.com/guides/tutorials/license-keys
 */

import { LicenseInfo, SubscriptionTier } from '@/types';

const LS_API_BASE = 'https://api.lemonsqueezy.com';
const INSTANCE_NAME = 'shoppilot-chrome-extension';

interface LSLicenseResponse {
  valid: boolean;
  error?: string;
  license_key: {
    id: number;
    status: string;           // 'active', 'inactive', 'expired', 'disabled'
    key: string;
    activation_limit: number;
    activation_usage: number;
    created_at: string;
    expires_at: string | null;
  };
  instance?: {
    id: string;
    name: string;
    created_at: string;
  };
  meta: {
    store_id: number;
    order_id: number;
    order_item_id: number;
    product_id: number;
    product_name: string;
    variant_id: number;
    variant_name: string;
    customer_id: number;
    customer_name: string;
    customer_email: string;
  };
}

/**
 * Derive subscription tier from LemonSqueezy variant name.
 * Convention: variant name contains "Pro" or "Business" (case-insensitive).
 */
function deriveTier(variantName: string): SubscriptionTier {
  const lower = variantName.toLowerCase();
  if (lower.includes('business') || lower.includes('enterprise')) return 'business';
  if (lower.includes('pro') || lower.includes('premium')) return 'pro';
  return 'pro'; // default to pro for any paid license
}

/**
 * Activate a license key on this instance.
 * Should be called once when the user first enters their license key.
 */
export async function activateLicense(licenseKey: string): Promise<{
  success: boolean;
  license?: LicenseInfo;
  error?: string;
}> {
  try {
    const response = await fetch(`${LS_API_BASE}/v1/licenses/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        license_key: licenseKey,
        instance_name: INSTANCE_NAME,
      }),
    });

    const data: LSLicenseResponse = await response.json();

    if (!response.ok || !data.valid) {
      // Handle specific error cases
      const errorMsg = data.error || getErrorMessage(data, response.status);
      return { success: false, error: errorMsg };
    }

    const license: LicenseInfo = {
      key: licenseKey,
      instanceId: data.instance?.id || '',
      status: data.license_key.status as LicenseInfo['status'],
      tier: deriveTier(data.meta.variant_name),
      customerName: data.meta.customer_name,
      customerEmail: data.meta.customer_email,
      validatedAt: Date.now(),
      expiresAt: data.license_key.expires_at
        ? new Date(data.license_key.expires_at).getTime()
        : undefined,
      variantName: data.meta.variant_name,
    };

    return { success: true, license };
  } catch (err) {
    return {
      success: false,
      error: `Network error: ${(err as Error).message}. Please check your internet connection.`,
    };
  }
}

/**
 * Validate an already-activated license key.
 * Used for periodic re-validation (every 24 hours).
 */
export async function validateLicense(licenseKey: string, instanceId: string): Promise<{
  success: boolean;
  license?: LicenseInfo;
  error?: string;
}> {
  try {
    const response = await fetch(`${LS_API_BASE}/v1/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        license_key: licenseKey,
        instance_id: instanceId,
      }),
    });

    const data: LSLicenseResponse = await response.json();

    if (!response.ok || !data.valid) {
      const errorMsg = data.error || getErrorMessage(data, response.status);
      return { success: false, error: errorMsg };
    }

    const license: LicenseInfo = {
      key: licenseKey,
      instanceId: instanceId,
      status: data.license_key.status as LicenseInfo['status'],
      tier: deriveTier(data.meta.variant_name),
      customerName: data.meta.customer_name,
      customerEmail: data.meta.customer_email,
      validatedAt: Date.now(),
      expiresAt: data.license_key.expires_at
        ? new Date(data.license_key.expires_at).getTime()
        : undefined,
      variantName: data.meta.variant_name,
    };

    return { success: true, license };
  } catch (err) {
    // On network error during revalidation, don't immediately invalidate
    // Return error but allow a grace period
    return {
      success: false,
      error: `Validation failed: ${(err as Error).message}`,
    };
  }
}

/**
 * Deactivate a license key (e.g., user wants to use on a different device).
 */
export async function deactivateLicense(licenseKey: string, instanceId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`${LS_API_BASE}/v1/licenses/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        license_key: licenseKey,
        instance_id: instanceId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to deactivate license' };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Map API responses to user-friendly error messages.
 */
function getErrorMessage(data: any, httpStatus: number): string {
  if (httpStatus === 404) return 'Invalid license key. Please check and try again.';
  if (httpStatus === 400) return 'Invalid request. Please check your license key format.';
  if (httpStatus === 422) {
    // Usually means activation limit reached
    return 'License activation limit reached. Deactivate on another device first, or contact support.';
  }
  
  const status = data?.license_key?.status;
  if (status === 'expired') return 'Your license has expired. Please renew your subscription.';
  if (status === 'disabled') return 'This license has been disabled. Please contact support.';
  
  return data?.error || 'License validation failed. Please try again.';
}

/**
 * Check if a license is still valid (not expired, within grace period).
 * Grace period: 7 days after last successful validation.
 */
export function isLicenseValid(license: LicenseInfo | null): boolean {
  if (!license) return false;
  if (license.status !== 'active') return false;

  // Check expiry
  if (license.expiresAt && Date.now() > license.expiresAt) return false;

  // Grace period: if last validation was more than 7 days ago, consider invalid
  const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  if (Date.now() - license.validatedAt > GRACE_PERIOD_MS) return false;

  return true;
}
