import React, { useEffect, useState } from 'react';
import { Creator, InviteMessage, AIProvider, AI_PROVIDERS } from '@/types';
import { useToast } from '@/components/Toast';
import { getSavedCreators, saveCreators, getSettings, updateSettings } from '@/utils/storage';
import { CreatorsTab } from '@/components/CreatorsTab';
import { InviteTab } from '@/components/InviteTab';
import { ListingTab } from '@/components/ListingTab';
import { MonitorTab } from '@/components/MonitorTab';
import { useI18n } from '@/i18n';

type Tab = 'creators' | 'invite' | 'listing' | 'monitor';
type Tone = 'professional' | 'friendly' | 'casual';

export function SidePanelApp() {
  const [activeTab, setActiveTab] = useState<Tab>('creators');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<InviteMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTone, setCurrentTone] = useState<Tone>('professional');
  const [aiProvider, setAiProvider] = useState<AIProvider>('deepseek');
  const [aiModel, setAiModel] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const { t } = useI18n();
  const { showToast, ToastElement } = useToast();

  // Load AI settings
  useEffect(() => {
    getSettings().then(s => {
      setAiProvider(s.aiProvider || 'deepseek');
      setAiModel(s.aiModel || '');
    });
  }, []);

  // Check for recovered/running batch on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_INVITE_QUEUE' }).then(state => {
      if (state?.isRunning) {
        setBatchProgress({
          isRunning: true,
          total: state.stats.total,
          completed: state.stats.completed,
          succeeded: state.stats.succeeded,
          failed: state.stats.failed,
          recovered: state.recovered,
        });
        // Start polling
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(async () => {
            try {
              const s = await chrome.runtime.sendMessage({ type: 'GET_INVITE_QUEUE' });
              if (!s) return;
              setBatchProgress({
                isRunning: s.isRunning,
                total: s.stats.total,
                completed: s.stats.completed,
                succeeded: s.stats.succeeded,
                failed: s.stats.failed,
                recovered: s.recovered,
              });
              if (!s.isRunning) {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
                showToast(`Batch complete: ${s.stats.succeeded} sent, ${s.stats.failed} failed`, s.stats.failed > 0 ? 'info' : 'success');
                setTimeout(() => setBatchProgress(null), 5000);
              }
            } catch {}
          }, 1000);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadCreators();
    const handler = (msg: any) => {
      if (msg.type === 'CREATORS_DATA') {
        const incoming: Creator[] = msg.payload;
        // Update UI immediately (dedup by id)
        setCreators(prev => {
          const map = new Map(prev.map(c => [c.id, c]));
          for (const c of incoming) {
            map.set(c.id, c);
          }
          return Array.from(map.values());
        });
        showToast(`${incoming.length} new creators captured!`, 'success');
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  async function loadCreators() {
    // Use chunked storage API (auto-migrates from legacy format)
    const saved = await getSavedCreators();
    if (saved.length > 0) setCreators(saved);
  }

  async function generateInvite(creator: Creator, tone?: Tone) {
    setLoading(true);
    setSelectedCreator(creator);
    const useTone = tone || currentTone;

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'GENERATE_INVITE',
        payload: { creator, tone: useTone },
      });

      if (result?.limitReached) {
        showToast(`${result.tier.toUpperCase()} limit reached (${result.current}/${result.limit}). Upgrade to continue.`, 'error');
      } else if ('error' in result) {
        showToast(result.error, 'error');
      } else {
        setGeneratedMessage(result);
        setActiveTab('invite');
        showToast('Invite message generated!', 'success');
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const [batchProgress, setBatchProgress] = useState<{
    isRunning: boolean;
    total: number;
    completed: number;
    succeeded: number;
    failed: number;
    recovered?: boolean;
  } | null>(null);
  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  async function handleBatchInvite(selectedCreators: Creator[]) {
    if (selectedCreators.length === 0) return;
    
    if (selectedCreators.length === 1) {
      generateInvite(selectedCreators[0]);
      return;
    }

    // Start batch invite
    const result = await chrome.runtime.sendMessage({
      type: 'BATCH_INVITE',
      payload: { creators: selectedCreators, tone: currentTone },
    });

    if (result?.limitReached) {
      showToast(`${result.tier.toUpperCase()} limit reached (${result.current}/${result.limit}). Upgrade to send more invites.`, 'error');
      return;
    }
    if (result?.error) {
      showToast(result.error, 'error');
      return;
    }

    showToast(`Batch invite started for ${selectedCreators.length} creators`, 'success');

    // Clean up any existing poll
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    // Poll for progress
    pollIntervalRef.current = setInterval(async () => {
      try {
        const state = await chrome.runtime.sendMessage({ type: 'GET_INVITE_QUEUE' });
        if (!state) return;
        setBatchProgress({
          isRunning: state.isRunning,
          total: state.stats.total,
          completed: state.stats.completed,
          succeeded: state.stats.succeeded,
          failed: state.stats.failed,
          recovered: state.recovered,
        });

        if (!state.isRunning) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          showToast(
            `Batch complete: ${state.stats.succeeded} sent, ${state.stats.failed} failed`,
            state.stats.failed > 0 ? 'info' : 'success'
          );
          setTimeout(() => setBatchProgress(null), 5000);
        }
      } catch {
        // Background may be restarting, ignore
      }
    }, 1000);
  }

  async function handleStopBatch() {
    await chrome.runtime.sendMessage({ type: 'STOP_BATCH_INVITE' });
    showToast('Batch invite stopped', 'info');
  }

  function handleToneChange(tone: Tone) {
    setCurrentTone(tone);
    if (selectedCreator) {
      generateInvite(selectedCreator, tone);
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'creators', label: t('tab.creators'), icon: '👥' },
    { key: 'invite', label: t('tab.invite'), icon: '✉️' },
    { key: 'listing', label: t('tab.listing'), icon: '✨' },
    { key: 'monitor', label: t('tab.monitor'), icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-tiktok-gray-50 flex flex-col">
      {ToastElement}

      {batchProgress && (
        <div className="bg-gradient-to-r from-brand-primary/10 to-tiktok-blue/10 border-b border-brand-primary/20 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${batchProgress.isRunning ? 'bg-green-500 animate-pulse' : 'bg-tiktok-gray-400'}`} />
              <span className="text-xs font-semibold text-tiktok-gray-900">
                {batchProgress.isRunning ? 'Batch Invite Running...' : 'Batch Complete'}
              </span>
              {(batchProgress as any).recovered && (
                <span className="text-[10px] text-blue-600 font-medium ml-1">(resumed)</span>
              )}
            </div>
            {batchProgress.isRunning && (
              <button
                onClick={handleStopBatch}
                className="text-[10px] text-red-500 font-semibold hover:text-red-700"
              >
                Stop
              </button>
            )}
          </div>
          <div className="w-full bg-tiktok-gray-200 rounded-full h-1.5 mb-1.5">
            <div
              className="bg-brand-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-tiktok-gray-600">
            <span>{batchProgress.completed}/{batchProgress.total} processed</span>
            <span className="flex gap-2">
              <span className="text-green-600">✓ {batchProgress.succeeded}</span>
              {batchProgress.failed > 0 && <span className="text-red-500">✗ {batchProgress.failed}</span>}
            </span>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-tiktok-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚀</span>
          <h1 className="font-bold text-tiktok-gray-900">ShopPilot</h1>
        </div>
        {/* AI Model Indicator / Picker */}
        <div className="relative">
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-tiktok-gray-600 bg-tiktok-gray-100 hover:bg-tiktok-gray-200 rounded-md transition-colors"
          >
            <span className="text-xs">🤖</span>
            <span className="font-medium truncate max-w-[100px]">
              {AI_PROVIDERS[aiProvider]?.name || aiProvider}
            </span>
            <span className="text-[9px] text-tiktok-gray-400">▼</span>
          </button>
          {showModelPicker && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowModelPicker(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-tiktok-gray-200 rounded-lg shadow-lg z-40 w-52 max-h-64 overflow-y-auto">
                {(Object.entries(AI_PROVIDERS) as [AIProvider, typeof AI_PROVIDERS[AIProvider]][])
                  .filter(([key]) => key !== 'custom')
                  .map(([key, config]) => (
                    <div key={key} className="border-b border-tiktok-gray-100 last:border-b-0">
                      <p className="text-[10px] font-semibold text-tiktok-gray-500 px-3 pt-2 pb-0.5">{config.name}</p>
                      {config.models.map(model => (
                        <button
                          key={model}
                          onClick={async () => {
                            setAiProvider(key);
                            setAiModel(model);
                            await updateSettings({ aiProvider: key, aiModel: model });
                            setShowModelPicker(false);
                            showToast(`Switched to ${config.name} / ${model}`, 'success');
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-tiktok-gray-50 transition-colors ${
                            aiProvider === key && (aiModel || config.defaultModel) === model
                              ? 'text-brand-primary font-medium bg-brand-primary/5'
                              : 'text-tiktok-gray-700'
                          }`}
                        >
                          {model}
                          {aiProvider === key && (aiModel || config.defaultModel) === model && (
                            <span className="ml-1 text-brand-primary">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border-b border-tiktok-gray-200 flex">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
              activeTab === tab.key
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-tiktok-gray-500 hover:text-tiktok-gray-700'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'creators' && (
          <CreatorsTab
            creators={creators}
            onGenerateInvite={generateInvite}
            onBatchInvite={handleBatchInvite}
            loading={loading}
          />
        )}
        {activeTab === 'invite' && (
          <InviteTab
            creator={selectedCreator}
            message={generatedMessage}
            onRegenerate={() => selectedCreator && generateInvite(selectedCreator)}
            loading={loading}
            onChangeTone={handleToneChange}
          />
        )}
        {activeTab === 'listing' && <ListingTab />}
        {activeTab === 'monitor' && <MonitorTab />}
      </div>
    </div>
  );
}
