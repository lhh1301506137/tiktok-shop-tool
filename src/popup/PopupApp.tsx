import React, { useEffect, useState } from 'react';
import { UserSettings, UsageStats, AIProvider } from '@/types';
import { DashboardTab } from './DashboardTab';
import { SettingsTab } from './SettingsTab';
import { FeedbackWidget } from '@/components/FeedbackWidget';

export function PopupApp() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Helper: sendMessage with retry for Service Worker cold-start
  async function safeSendMessage(msg: any, retries = 2): Promise<any> {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await chrome.runtime.sendMessage(msg);
        return res;
      } catch (err) {
        if (i < retries) {
          // Service Worker may still be waking up — wait and retry
          await new Promise(r => setTimeout(r, 300));
        } else {
          console.error('[ShopPilot] sendMessage failed:', err);
          throw err;
        }
      }
    }
  }

  async function loadData() {
    try {
      const settingsResult = await safeSendMessage({ type: 'GET_SETTINGS' });
      setSettings(settingsResult);
      setApiKeyInput(settingsResult.apiKey || '');
    } catch {
      // Fallback: read settings directly from storage
      const stored = await chrome.storage.local.get('settings');
      const fallback = { tier: 'free' as const, defaultCommission: 15, defaultTone: 'professional' as const, language: 'en', theme: 'light' as const, aiProvider: 'deepseek' as AIProvider, ...stored.settings };
      setSettings(fallback);
      setApiKeyInput(fallback.apiKey || '');
    }

    const usageResult = await chrome.storage.local.get('usage');
    setUsage(usageResult.usage || {
      invitesSentToday: 0,
      aiGenerationsToday: 0,
      creatorsScraped: 0,
      productsTracked: 0,
      trialAiUsed: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    });
  }

  async function saveApiKey() {
    setSaving(true);
    try {
      await safeSendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { apiKey: apiKeyInput },
      });
    } catch {
      // Fallback: write directly to storage
      const stored = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...stored.settings, apiKey: apiKeyInput } });
    }
    setSaving(false);
    await loadData();
  }

  async function updateSetting(partial: Partial<UserSettings>) {
    try {
      await safeSendMessage({
        type: 'UPDATE_SETTINGS',
        payload: partial,
      });
    } catch {
      // Fallback: write directly to storage
      const stored = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...stored.settings, ...partial } });
    }
    await loadData();
  }

  function openSidePanel() {
    const sidePanelUrl = chrome.runtime.getURL('src/sidepanel/index.html');
    chrome.tabs.create({ url: sidePanelUrl });
    window.close();
  }

  return (
    <div className="min-h-[480px] bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-tiktok-red to-tiktok-blue p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          <div>
            <h1 className="text-white font-bold text-lg">ShopPilot</h1>
            <p className="text-white/80 text-xs">TikTok Shop Seller Tool</p>
          </div>
          <div className="ml-auto">
            <span className={`badge ${settings?.tier === 'free' ? 'bg-white/20 text-white' : 'bg-yellow-400 text-yellow-900'}`}>
              {settings?.tier?.toUpperCase() || 'FREE'}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-tiktok-gray-200">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'home'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-tiktok-gray-500 hover:text-tiktok-gray-700'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-tiktok-gray-500 hover:text-tiktok-gray-700'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {showFeedback ? (
          <FeedbackWidget onClose={() => setShowFeedback(false)} />
        ) : activeTab === 'home' ? (
          <DashboardTab
            settings={settings}
            usage={usage}
            onOpenSidePanel={openSidePanel}
          />
        ) : (
          <SettingsTab
            settings={settings}
            apiKeyInput={apiKeyInput}
            saving={saving}
            trialUsed={usage?.trialAiUsed || 0}
            onApiKeyChange={setApiKeyInput}
            onSaveApiKey={saveApiKey}
            onUpdateSetting={updateSetting}
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-tiktok-gray-100 p-3 text-center">
        <p className="text-xs text-tiktok-gray-400">
          ShopPilot v0.5.0 |{' '}
          <button onClick={() => setShowFeedback(!showFeedback)} className="text-brand-primary hover:underline">
            {showFeedback ? 'Back' : 'Feedback'}
          </button>{' '}
          | <a href="https://shoppilot.pro/#pricing" target="_blank" rel="noopener" className="text-brand-primary hover:underline">Upgrade</a>
        </p>
      </div>
    </div>
  );
}
