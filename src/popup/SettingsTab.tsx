import React from 'react';
import { UserSettings, AIProvider, AI_PROVIDERS, TRIAL_AI_LIMIT } from '@/types';

interface SettingsTabProps {
  settings: UserSettings | null;
  apiKeyInput: string;
  saving: boolean;
  trialUsed?: number;
  onApiKeyChange: (key: string) => void;
  onSaveApiKey: () => void;
  onUpdateSetting: (partial: Partial<UserSettings>) => void;
}

export function SettingsTab({
  settings,
  apiKeyInput,
  saving,
  trialUsed = 0,
  onApiKeyChange,
  onSaveApiKey,
  onUpdateSetting,
}: SettingsTabProps) {
  const currentProvider = settings?.aiProvider || 'deepseek';
  const providerConfig = AI_PROVIDERS[currentProvider];
  const hasApiKey = !!settings?.apiKey;

  return (
    <div className="space-y-4">
      {/* Trial Status (when no key configured) */}
      {!hasApiKey && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
          <p className="text-blue-800 text-xs font-semibold mb-2">
            🧪 Trial Mode: {TRIAL_AI_LIMIT - trialUsed}/{TRIAL_AI_LIMIT} free AI calls left
          </p>
          <p className="text-blue-700 text-[11px] mb-2">
            Set up your own key for unlimited AI calls. Pick any provider below:
          </p>
          <div className="text-[11px] text-blue-700 space-y-0.5">
            <p>💰 <strong>Budget</strong>: <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" className="underline">DeepSeek</a> · <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" rel="noopener" className="underline">GLM 智谱</a></p>
            <p>🌏 <strong>国内</strong>: <a href="https://platform.moonshot.cn/console/api-keys" target="_blank" rel="noopener" className="underline">Kimi</a> · <a href="https://platform.minimaxi.com/user-center/basic-information/interface-key" target="_blank" rel="noopener" className="underline">MiniMax</a></p>
            <p>🌐 <strong>Global</strong>: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="underline">OpenAI</a> · <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="underline">Claude</a> · <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline">Gemini</a></p>
          </div>
          <p className="text-[10px] text-blue-600 mt-1.5">
            Select a provider below → Paste your API key → Save
          </p>
        </div>
      )}

      {/* AI Provider */}
      <div>
        <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">
          AI Provider
        </label>
        <select
          value={currentProvider}
          onChange={e => onUpdateSetting({
            aiProvider: e.target.value as AIProvider,
            aiModel: undefined,
          })}
          className="input-field text-sm"
        >
          {(Object.keys(AI_PROVIDERS) as AIProvider[]).map(key => (
            <option key={key} value={key}>{AI_PROVIDERS[key].name}</option>
          ))}
        </select>
      </div>

      {/* Model Selection */}
      {currentProvider !== 'custom' && providerConfig.models.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">
            Model
          </label>
          <select
            value={settings?.aiModel || providerConfig.defaultModel}
            onChange={e => onUpdateSetting({ aiModel: e.target.value })}
            className="input-field text-sm"
          >
            {providerConfig.models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      )}

      {/* Custom API URL */}
      {currentProvider === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">
            API URL (OpenAI-compatible)
          </label>
          <input
            type="text"
            value={settings?.customApiUrl || ''}
            onChange={e => onUpdateSetting({ customApiUrl: e.target.value })}
            placeholder="https://your-api.com/v1/chat/completions"
            className="input-field text-sm"
          />
        </div>
      )}

      {/* API Key */}
      <div>
        <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">
          {providerConfig.name} API Key
        </label>
        <input
          type="password"
          value={apiKeyInput}
          onChange={e => onApiKeyChange(e.target.value)}
          placeholder={providerConfig.keyPrefix ? `${providerConfig.keyPrefix}...` : 'Your API key'}
          className="input-field text-sm"
        />
        <p className="text-xs text-tiktok-gray-400 mt-1">
          Your key stays local. We never send it to our servers.
        </p>
        <button
          onClick={onSaveApiKey}
          disabled={saving}
          className="btn-primary w-full text-sm mt-2"
        >
          {saving ? 'Saving...' : 'Save Key'}
        </button>
      </div>

      {/* Saved indicator */}
      {hasApiKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
          <p className="text-green-700 text-xs">
            ✅ {providerConfig.name} key configured &middot; Model: {settings?.aiModel || providerConfig.defaultModel}
          </p>
          {providerConfig.keyUrl && (
            <p className="text-green-600 text-[10px] mt-1">
              Manage keys: <a href={providerConfig.keyUrl} target="_blank" rel="noopener" className="underline">{providerConfig.name} Dashboard</a>
            </p>
          )}
        </div>
      )}

      <hr className="border-tiktok-gray-100" />

      {/* My Product — injected into AI invites */}
      <div>
        <h3 className="text-sm font-semibold text-tiktok-gray-700 mb-2">My Product</h3>
        <p className="text-[11px] text-tiktok-gray-400 mb-3">
          This info is automatically included in AI-generated invitations to make them more relevant.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-tiktok-gray-600 mb-1">Product Name</label>
            <input
              type="text"
              value={settings?.productName || ''}
              onChange={e => onUpdateSetting({ productName: e.target.value || undefined })}
              placeholder="e.g. Glow Serum, LED Desk Lamp..."
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tiktok-gray-600 mb-1">One-line Description</label>
            <input
              type="text"
              value={settings?.productDescription || ''}
              onChange={e => onUpdateSetting({ productDescription: e.target.value || undefined })}
              placeholder="e.g. Vitamin C serum for brighter skin, 30ml"
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tiktok-gray-600 mb-1">Commission Rate</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="80"
                value={settings?.commissionRate || settings?.defaultCommission || 15}
                onChange={e => onUpdateSetting({ commissionRate: parseInt(e.target.value), defaultCommission: parseInt(e.target.value) })}
                className="input-field text-sm w-20"
              />
              <span className="text-sm text-tiktok-gray-500">%</span>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-tiktok-gray-100" />

      {/* Invitation Tone */}
      <div>
        <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">
          Default Invitation Tone
        </label>
        <select
          value={settings?.defaultTone || 'professional'}
          onChange={e => onUpdateSetting({ defaultTone: e.target.value as any })}
          className="input-field text-sm"
        >
          <option value="professional">Professional</option>
          <option value="casual">Casual</option>
          <option value="friendly">Friendly</option>
        </select>
      </div>

      <hr className="border-tiktok-gray-100" />

      {/* Formspree Integration */}
      <div>
        <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">
          Formspree ID <span className="text-tiktok-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={settings?.formspreeId || ''}
          onChange={e => onUpdateSetting({ formspreeId: e.target.value.trim() || undefined })}
          placeholder="e.g. xyzabcde"
          className="input-field text-sm"
        />
        <p className="text-xs text-tiktok-gray-400 mt-1">
          Enable online feedback submission. Get a free form at{' '}
          <a href="https://formspree.io" target="_blank" rel="noopener" className="underline">formspree.io</a>
        </p>
      </div>
    </div>
  );
}
