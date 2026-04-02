import React from 'react';
import { UserSettings, UsageStats, TIER_LIMITS } from '@/types';
import { StatCard } from '@/components/StatCard';
import { UsageWarning } from '@/components/UpgradePrompt';

interface DashboardTabProps {
  settings: UserSettings | null;
  usage: UsageStats | null;
  onOpenSidePanel: () => void;
}

export function DashboardTab({ settings, usage, onOpenSidePanel }: DashboardTabProps) {
  const limits = settings ? TIER_LIMITS[settings.tier] : TIER_LIMITS.free;

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Invites Today"
          value={usage?.invitesSentToday || 0}
          max={limits.dailyInvites}
        />
        <StatCard
          label="AI Generations"
          value={usage?.aiGenerationsToday || 0}
          max={limits.dailyAiGenerations}
        />
        <StatCard
          label="Creators Saved"
          value={usage?.creatorsScraped || 0}
          max={limits.maxSavedCreators}
        />
        <StatCard
          label="Products Tracked"
          value={usage?.productsTracked || 0}
          max={limits.maxTrackedProducts}
        />
      </div>

      {/* Usage Warnings */}
      <div className="space-y-2">
        <UsageWarning label="Invites" current={usage?.invitesSentToday || 0} limit={limits.dailyInvites} tier={settings?.tier || 'free'} />
        <UsageWarning label="AI Generations" current={usage?.aiGenerationsToday || 0} limit={limits.dailyAiGenerations} tier={settings?.tier || 'free'} />
        <UsageWarning label="Creators" current={usage?.creatorsScraped || 0} limit={limits.maxSavedCreators} tier={settings?.tier || 'free'} />
        <UsageWarning label="Products" current={usage?.productsTracked || 0} limit={limits.maxTrackedProducts} tier={settings?.tier || 'free'} />
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-tiktok-gray-700">Quick Actions</h3>
        <button onClick={onOpenSidePanel} className="btn-primary w-full text-sm">
          Open Full Panel
        </button>
        <a
          href="https://seller-us.tiktok.com/affiliate/marketplace"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary w-full text-sm block text-center"
        >
          Go to Find Creators
        </a>
      </div>

      {/* API Key Warning */}
      {!settings?.apiKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-amber-800 text-xs">
            ⚠️ Set your API Key in Settings to enable AI features
          </p>
        </div>
      )}
    </div>
  );
}
