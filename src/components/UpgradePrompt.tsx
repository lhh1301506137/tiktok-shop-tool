import React from 'react';
import { LS_CONFIG } from '@/types';

const UPGRADE_URL = 'https://shoppilot.pro/#pricing';

interface UpgradePromptProps {
  tier: string;
  limitType: string;
  current: number;
  limit: number;
  compact?: boolean;
}

const LIMIT_LABELS: Record<string, string> = {
  dailyInvites: 'daily invites',
  dailyAiGenerations: 'daily AI generations',
  maxTrackedProducts: 'tracked products',
  maxSavedCreators: 'saved creators',
};

function handleUpgradePro() {
  chrome.tabs.create({ url: LS_CONFIG.proCheckoutUrl || UPGRADE_URL });
}

function handleUpgradeBusiness() {
  chrome.tabs.create({ url: LS_CONFIG.businessCheckoutUrl || UPGRADE_URL });
}

function handleUpgrade() {
  // Default: open pricing page (user can pick tier)
  chrome.tabs.create({ url: UPGRADE_URL });
}

export function UpgradePrompt({ tier, limitType, current, limit, compact }: UpgradePromptProps) {
  const label = LIMIT_LABELS[limitType] || limitType;

  if (compact) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
        <p className="text-amber-800 text-xs">
          ⚠️ {current}/{limit} {label} used ({tier.toUpperCase()} plan).{' '}
          <button onClick={handleUpgrade} className="text-brand-primary font-semibold hover:underline">
            Upgrade
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center">
      <p className="text-2xl mb-2">🔒</p>
      <h3 className="font-bold text-sm text-tiktok-gray-900 mb-1">
        {tier.toUpperCase()} Plan Limit Reached
      </h3>
      <p className="text-xs text-tiktok-gray-600 mb-3">
        You've used {current}/{limit} {label}.
        Upgrade for higher limits and more features.
      </p>
      <div className="flex gap-2 justify-center">
        {tier === 'free' && (
          <>
            <button onClick={handleUpgradePro} className="btn-primary text-xs !py-1.5 !px-4">
              Pro — $19/mo
            </button>
            <button onClick={handleUpgradeBusiness} className="bg-tiktok-gray-800 hover:bg-tiktok-gray-900 text-white text-xs rounded-lg !py-1.5 !px-4 transition-colors">
              Business — $49/mo
            </button>
          </>
        )}
        {tier === 'pro' && (
          <button onClick={handleUpgradeBusiness} className="btn-primary text-xs !py-1.5 !px-4">
            Upgrade to Business — $49/mo
          </button>
        )}
      </div>
      <p className="text-[10px] text-tiktok-gray-400 mt-2">
        Already have a key?{' '}
        <span className="underline cursor-pointer" onClick={() => {
          // Navigate to settings tab — dispatch custom event
          window.dispatchEvent(new CustomEvent('shoppilot:goto-settings'));
        }}>
          Enter license key →
        </span>
      </p>
    </div>
  );
}

/** Warning banner for usage approaching limit (>80%) */
export function UsageWarning({ label, current, limit, tier }: {
  label: string;
  current: number;
  limit: number;
  tier: string;
}) {
  if (limit === -1) return null; // unlimited
  const percentage = (current / limit) * 100;
  if (percentage < 80) return null;

  const isAtLimit = current >= limit;

  return (
    <div className={`border rounded-lg p-2 text-xs ${
      isAtLimit
        ? 'bg-red-50 border-red-200 text-red-700'
        : 'bg-amber-50 border-amber-200 text-amber-700'
    }`}>
      {isAtLimit
        ? <>🚫 {label}: {current}/{limit} — limit reached ({tier.toUpperCase()}).{' '}
            <button onClick={handleUpgrade} className="font-semibold underline">Upgrade</button>
          </>
        : `⚠️ ${label}: ${current}/${limit} — approaching limit (${tier.toUpperCase()})`
      }
    </div>
  );
}
