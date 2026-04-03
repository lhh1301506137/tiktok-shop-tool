import React from 'react';
import { UserSettings, AIProvider, AI_PROVIDERS } from '@/types';

interface SettingsTabProps {
  settings: UserSettings | null;
  apiKeyInput: string;
  saving: boolean;
  onApiKeyChange: (key: string) => void;
  onSaveApiKey: () => void;
  onUpdateSetting: (partial: Partial<UserSettings>) => void;
}

export function SettingsTab({
  settings,
  apiKeyInput,
  saving,
  onApiKeyChange,
  onSaveApiKey,
  onUpdateSetting,
}: SettingsTabProps) {
  const currentProvider = settings?.aiProvider || 'minimax';
  const providerConfig = AI_PROVIDERS[currentProvider];

  return (
    <div className="space-y-4">
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
      {settings?.apiKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
          <p className="text-green-700 text-xs">
            ✅ {providerConfig.name} key configured &middot; Model: {settings.aiModel || providerConfig.defaultModel}
          </p>
        </div>
      )}

      <hr className="border-tiktok-gray-100" />

      {/* Default Commission */}
      <div>
        <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">
          Default Commission Rate
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="80"
            value={settings?.defaultCommission || 15}
            onChange={e => onUpdateSetting({ defaultCommission: parseInt(e.target.value) })}
            className="input-field text-sm w-20"
          />
          <span className="text-sm text-tiktok-gray-500">%</span>
        </div>
      </div>

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
