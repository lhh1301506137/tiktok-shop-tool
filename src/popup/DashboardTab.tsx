import React, { useEffect, useState } from 'react';
import { UserSettings, UsageStats, TIER_LIMITS, TRIAL_AI_LIMIT } from '@/types';
import { StatCard } from '@/components/StatCard';
import { UsageWarning } from '@/components/UpgradePrompt';
import { getWeeklyStats, WeeklyStats } from '@/utils/storage';

interface DashboardTabProps {
  settings: UserSettings | null;
  usage: UsageStats | null;
  onOpenSidePanel: () => void;
}

export function DashboardTab({ settings, usage, onOpenSidePanel }: DashboardTabProps) {
  const limits = settings ? TIER_LIMITS[settings.tier] : TIER_LIMITS.free;
  const hasApiKey = !!settings?.apiKey;
  const trialUsed = usage?.trialAiUsed || 0;
  const trialRemaining = TRIAL_AI_LIMIT - trialUsed;
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);

  useEffect(() => {
    getWeeklyStats().then(setWeeklyStats);
  }, []);

  return (
    <div className="space-y-4">
      {/* Trial Mode Banner — only show when no API key */}
      {!hasApiKey && (
        <div className={`border rounded-lg p-3 ${
          trialRemaining > 0
            ? 'bg-blue-50 border-blue-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          {trialRemaining > 0 ? (
            <>
              <p className="text-blue-800 text-xs font-semibold mb-1">
                🎉 Trial Mode — {trialRemaining} free AI calls remaining
              </p>
              <p className="text-blue-700 text-[11px]">
                Try ShopPilot's AI features without any setup! Add your own API key in Settings for unlimited use.
              </p>
            </>
          ) : (
            <>
              <p className="text-amber-800 text-xs font-semibold mb-1">
                ⏰ Trial ended — Add your API key to continue
              </p>
              <p className="text-amber-700 text-[11px] mb-1.5">
                Pick any AI provider below (60 seconds to set up):
              </p>
              <div className="text-[11px] text-amber-700 space-y-0.5">
                <p>💰 Budget: <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" className="underline font-medium">DeepSeek</a> · <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" rel="noopener" className="underline">GLM</a></p>
                <p>🌐 Global: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="underline">OpenAI</a> · <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="underline">Claude</a> · <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline">Gemini</a></p>
              </div>
              <p className="text-[10px] text-amber-600 mt-1">Sign up → Create Key → Settings tab → Paste → Save</p>
            </>
          )}
        </div>
      )}

      {/* Quick Stats — Today */}
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

      {/* Weekly Stats Summary */}
      {weeklyStats && (weeklyStats.totalInvites > 0 || weeklyStats.totalAiGenerations > 0) && (
        <div className="border border-tiktok-gray-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-tiktok-gray-700 mb-2">📊 This Week</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-tiktok-gray-50 rounded p-2">
              <p className="text-lg font-bold text-brand-primary">{weeklyStats.totalInvites}</p>
              <p className="text-[10px] text-tiktok-gray-500">Total Invites</p>
            </div>
            <div className="bg-tiktok-gray-50 rounded p-2">
              <p className="text-lg font-bold text-brand-primary">{weeklyStats.totalAiGenerations}</p>
              <p className="text-[10px] text-tiktok-gray-500">AI Generations</p>
            </div>
          </div>
          {/* Mini bar chart — 7 days */}
          <div className="flex items-end gap-0.5 h-10">
            {weeklyStats.dailyData.map((day) => {
              const maxVal = Math.max(...weeklyStats.dailyData.map(d => d.invitesSent + d.aiGenerations), 1);
              const total = day.invitesSent + day.aiGenerations;
              const heightPct = Math.max((total / maxVal) * 100, 4);
              const dayLabel = day.date.slice(5); // MM-DD
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full bg-brand-primary/70 rounded-t-sm transition-all"
                    style={{ height: `${heightPct}%` }}
                    title={`${dayLabel}: ${day.invitesSent} invites, ${day.aiGenerations} AI`}
                  />
                  <span className="text-[8px] text-tiktok-gray-400">{dayLabel}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-tiktok-gray-400">
              Avg: {weeklyStats.avgInvitesPerDay} invites/day
            </span>
            <span className="text-[10px] text-tiktok-gray-400">
              {weeklyStats.avgAiPerDay} AI/day
            </span>
          </div>
        </div>
      )}

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
    </div>
  );
}
