import React, { useEffect, useState } from 'react';
import { UserSettings, UsageStats, TIER_LIMITS, TRIAL_AI_LIMIT } from '@/types';
import { StatCard } from '@/components/StatCard';
import { UsageWarning } from '@/components/UpgradePrompt';
import { getWeeklyStats, WeeklyStats } from '@/utils/storage';
import { useI18n } from '@/i18n';

interface DashboardTabProps {
  settings: UserSettings | null;
  usage: UsageStats | null;
  onOpenSidePanel: () => void;
}

export function DashboardTab({ settings, usage, onOpenSidePanel }: DashboardTabProps) {
  const { t } = useI18n();
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
      {/* Trial Mode Banner */}
      {!hasApiKey && (
        <div className={`border rounded-lg p-3 ${
          trialRemaining > 0
            ? 'bg-blue-50 border-blue-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          {trialRemaining > 0 ? (
            <>
              <p className="text-blue-800 text-xs font-semibold mb-1">
                🎉 {t('dashboard.trial_mode', { remaining: trialRemaining })}
              </p>
              <p className="text-blue-700 text-[11px]">
                {t('dashboard.trial_desc')}
              </p>
            </>
          ) : (
            <>
              <p className="text-amber-800 text-xs font-semibold mb-1">
                ⏰ {t('dashboard.trial_ended')}
              </p>
              <p className="text-amber-700 text-[11px] mb-1.5">
                {t('dashboard.trial_setup')}
              </p>
              <div className="text-[11px] text-amber-700 space-y-0.5">
                <p>{t('settings.budget')}: <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" className="underline font-medium">DeepSeek</a> · <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" rel="noopener" className="underline">GLM</a></p>
                <p>{t('settings.global')}: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="underline">OpenAI</a> · <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="underline">Claude</a> · <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline">Gemini</a></p>
              </div>
              <p className="text-[10px] text-amber-600 mt-1">{t('dashboard.trial_steps')}</p>
            </>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t('dashboard.invites_today')} value={usage?.invitesSentToday || 0} max={limits.dailyInvites} />
        <StatCard label={t('dashboard.ai_generations')} value={usage?.aiGenerationsToday || 0} max={limits.dailyAiGenerations} />
        <StatCard label={t('dashboard.creators_saved')} value={usage?.creatorsScraped || 0} max={limits.maxSavedCreators} />
        <StatCard label={t('dashboard.products_tracked')} value={usage?.productsTracked || 0} max={limits.maxTrackedProducts} />
      </div>

      {/* Weekly Stats */}
      {weeklyStats && (weeklyStats.totalInvites > 0 || weeklyStats.totalAiGenerations > 0) && (
        <div className="border border-tiktok-gray-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-tiktok-gray-700 mb-2">{t('dashboard.this_week')}</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-tiktok-gray-50 rounded p-2">
              <p className="text-lg font-bold text-brand-primary">{weeklyStats.totalInvites}</p>
              <p className="text-[10px] text-tiktok-gray-500">{t('dashboard.total_invites')}</p>
            </div>
            <div className="bg-tiktok-gray-50 rounded p-2">
              <p className="text-lg font-bold text-brand-primary">{weeklyStats.totalAiGenerations}</p>
              <p className="text-[10px] text-tiktok-gray-500">{t('dashboard.total_ai')}</p>
            </div>
          </div>
          <div className="flex items-end gap-0.5 h-10">
            {weeklyStats.dailyData.map((day) => {
              const maxVal = Math.max(...weeklyStats.dailyData.map(d => d.invitesSent + d.aiGenerations), 1);
              const total = day.invitesSent + day.aiGenerations;
              const heightPct = Math.max((total / maxVal) * 100, 4);
              const dayLabel = day.date.slice(5);
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
              {t('dashboard.avg_invites', { count: weeklyStats.avgInvitesPerDay })}
            </span>
            <span className="text-[10px] text-tiktok-gray-400">
              {t('dashboard.avg_ai', { count: weeklyStats.avgAiPerDay })}
            </span>
          </div>
        </div>
      )}

      {/* Usage Warnings */}
      <div className="space-y-2">
        <UsageWarning label={t('dashboard.invites_today')} current={usage?.invitesSentToday || 0} limit={limits.dailyInvites} tier={settings?.tier || 'free'} />
        <UsageWarning label={t('dashboard.ai_generations')} current={usage?.aiGenerationsToday || 0} limit={limits.dailyAiGenerations} tier={settings?.tier || 'free'} />
        <UsageWarning label={t('dashboard.creators_saved')} current={usage?.creatorsScraped || 0} limit={limits.maxSavedCreators} tier={settings?.tier || 'free'} />
        <UsageWarning label={t('dashboard.products_tracked')} current={usage?.productsTracked || 0} limit={limits.maxTrackedProducts} tier={settings?.tier || 'free'} />
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-tiktok-gray-700">{t('dashboard.quick_actions')}</h3>
        <button onClick={onOpenSidePanel} className="btn-primary w-full text-sm">
          {t('dashboard.open_panel')}
        </button>
        <a
          href="https://seller-us.tiktok.com/affiliate/marketplace"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary w-full text-sm block text-center"
        >
          {t('dashboard.go_to_creators')}
        </a>
      </div>
    </div>
  );
}
