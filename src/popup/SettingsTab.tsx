import React, { useEffect, useState } from 'react';
import { UserSettings, AIProvider, AI_PROVIDERS, LicenseInfo, LS_CONFIG, TRIAL_AI_LIMIT } from '@/types';
import { ReferralSection } from '@/components/ReferralSection';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();
  const currentProvider = settings?.aiProvider || 'deepseek';
  const providerConfig = AI_PROVIDERS[currentProvider];
  const hasApiKey = !!settings?.apiKey;

  // License state
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_LICENSE' }).then((lic: LicenseInfo | null) => {
      setLicense(lic);
    }).catch(() => {});
  }, []);

  async function handleActivateLicense() {
    if (!licenseKeyInput.trim()) return;
    setLicenseLoading(true);
    setLicenseError(null);
    setLicenseSuccess(null);

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'ACTIVATE_LICENSE',
        payload: { licenseKey: licenseKeyInput.trim() },
      });

      if (result?.success && result?.license) {
        setLicense(result.license);
        setLicenseKeyInput('');
        setLicenseSuccess(t('settings.license_activated', { plan: result.license.variantName || result.license.tier }));
      } else {
        setLicenseError(result?.error || 'Failed to activate license');
      }
    } catch (e) {
      setLicenseError((e as Error).message);
    } finally {
      setLicenseLoading(false);
    }
  }

  async function handleDeactivateLicense() {
    setLicenseLoading(true);
    setLicenseError(null);

    try {
      const result = await chrome.runtime.sendMessage({ type: 'DEACTIVATE_LICENSE' });
      if (result?.success) {
        setLicense(null);
        setLicenseSuccess(t('settings.license_deactivated'));
      } else {
        setLicenseError(result?.error || 'Failed to deactivate');
      }
    } catch (e) {
      setLicenseError((e as Error).message);
    } finally {
      setLicenseLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ---- Language Switcher ---- */}
      <div>
        <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">
          {t('settings.language')}
        </label>
        <select
          value={settings?.language || 'en'}
          onChange={e => onUpdateSetting({ language: e.target.value as 'en' | 'zh' })}
          className="input-field text-sm"
        >
          <option value="en">{t('lang.en')}</option>
          <option value="zh">{t('lang.zh')}</option>
        </select>
      </div>

      <hr className="border-tiktok-gray-100" />

      {/* ---- Subscription & License ---- */}
      <div className="border border-tiktok-gray-200 rounded-lg p-3">
        <h3 className="text-sm font-semibold text-tiktok-gray-700 mb-2">{t('settings.subscription')}</h3>

        {license ? (
          <div className="space-y-2">
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
              <p className="text-green-800 text-xs font-semibold">
                ✅ {t('settings.plan_active', { plan: license.variantName || license.tier.toUpperCase() })}
              </p>
              {license.customerEmail && (
                <p className="text-green-700 text-[10px] mt-0.5">{license.customerEmail}</p>
              )}
              {license.expiresAt && (
                <p className="text-green-600 text-[10px] mt-0.5">
                  {t('settings.renews', { date: new Date(license.expiresAt).toLocaleDateString() })}
                </p>
              )}
            </div>
            <button
              onClick={handleDeactivateLicense}
              disabled={licenseLoading}
              className="text-xs text-red-500 hover:underline"
            >
              {licenseLoading ? t('common.processing') : t('settings.deactivate')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-tiktok-gray-500 bg-tiktok-gray-100 rounded px-2 py-0.5">
                {t('settings.free_plan')}
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-tiktok-gray-600 mb-1">
                {t('settings.license_key')}
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={licenseKeyInput}
                  onChange={e => setLicenseKeyInput(e.target.value)}
                  placeholder={t('settings.license_placeholder')}
                  className="input-field text-xs flex-1"
                  onKeyDown={e => e.key === 'Enter' && handleActivateLicense()}
                />
                <button
                  onClick={handleActivateLicense}
                  disabled={licenseLoading || !licenseKeyInput.trim()}
                  className="btn-primary text-xs px-3 shrink-0"
                >
                  {licenseLoading ? '...' : t('settings.activate')}
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <a href={LS_CONFIG.proCheckoutUrl} target="_blank" rel="noopener" className="text-[11px] text-brand-primary hover:underline font-medium">
                {t('settings.get_pro')}
              </a>
              <a href={LS_CONFIG.businessCheckoutUrl} target="_blank" rel="noopener" className="text-[11px] text-brand-primary hover:underline font-medium">
                {t('settings.get_business')}
              </a>
            </div>
          </div>
        )}

        {licenseError && <p className="text-red-600 text-[11px] mt-1.5">❌ {licenseError}</p>}
        {licenseSuccess && <p className="text-green-600 text-[11px] mt-1.5">✅ {licenseSuccess}</p>}
      </div>

      {/* ---- Referral ---- */}
      <ReferralSection />

      <hr className="border-tiktok-gray-100" />

      {/* ---- AI Configuration ---- */}

      {!hasApiKey && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
          <p className="text-blue-800 text-xs font-semibold mb-2">
            {t('settings.trial_status', { remaining: TRIAL_AI_LIMIT - trialUsed, total: TRIAL_AI_LIMIT })}
          </p>
          <p className="text-blue-700 text-[11px] mb-2">
            {t('settings.trial_setup_hint')}
          </p>
          <div className="text-[11px] text-blue-700 space-y-0.5">
            <p>{t('settings.budget')}: <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" className="underline">DeepSeek</a> · <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" rel="noopener" className="underline">GLM 智谱</a></p>
            <p>{t('settings.domestic')}: <a href="https://platform.moonshot.cn/console/api-keys" target="_blank" rel="noopener" className="underline">Kimi</a> · <a href="https://platform.minimaxi.com/user-center/basic-information/interface-key" target="_blank" rel="noopener" className="underline">MiniMax</a></p>
            <p>{t('settings.global')}: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="underline">OpenAI</a> · <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="underline">Claude</a> · <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline">Gemini</a></p>
          </div>
          <p className="text-[10px] text-blue-600 mt-1.5">
            {t('settings.select_provider_hint')}
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">{t('settings.ai_provider')}</label>
        <select
          value={currentProvider}
          onChange={e => onUpdateSetting({ aiProvider: e.target.value as AIProvider, aiModel: undefined })}
          className="input-field text-sm"
        >
          {(Object.keys(AI_PROVIDERS) as AIProvider[]).map(key => (
            <option key={key} value={key}>{AI_PROVIDERS[key].name}</option>
          ))}
        </select>
      </div>

      {currentProvider !== 'custom' && providerConfig.models.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">{t('settings.model')}</label>
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

      {currentProvider === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">{t('settings.api_url')}</label>
          <input
            type="text"
            value={settings?.customApiUrl || ''}
            onChange={e => onUpdateSetting({ customApiUrl: e.target.value })}
            placeholder="https://your-api.com/v1/chat/completions"
            className="input-field text-sm"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">
          {t('settings.api_key', { provider: providerConfig.name })}
        </label>
        <input
          type="password"
          value={apiKeyInput}
          onChange={e => onApiKeyChange(e.target.value)}
          placeholder={providerConfig.keyPrefix ? `${providerConfig.keyPrefix}...` : t('settings.api_key_placeholder')}
          className="input-field text-sm"
        />
        <p className="text-xs text-tiktok-gray-400 mt-1">{t('settings.key_local')}</p>
        <button onClick={onSaveApiKey} disabled={saving} className="btn-primary w-full text-sm mt-2">
          {saving ? t('settings.saving') : t('settings.save_key')}
        </button>
      </div>

      {hasApiKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
          <p className="text-green-700 text-xs">
            {t('settings.key_configured', { provider: providerConfig.name, model: settings?.aiModel || providerConfig.defaultModel })}
          </p>
          {providerConfig.keyUrl && (
            <p className="text-green-600 text-[10px] mt-1">
              {t('settings.manage_keys')} <a href={providerConfig.keyUrl} target="_blank" rel="noopener" className="underline">{providerConfig.name} Dashboard</a>
            </p>
          )}
        </div>
      )}

      <hr className="border-tiktok-gray-100" />

      {/* My Product */}
      <div>
        <h3 className="text-sm font-semibold text-tiktok-gray-700 mb-2">{t('settings.my_product')}</h3>
        <p className="text-[11px] text-tiktok-gray-400 mb-3">{t('settings.product_hint')}</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-tiktok-gray-600 mb-1">{t('settings.product_name')}</label>
            <input type="text" value={settings?.productName || ''} onChange={e => onUpdateSetting({ productName: e.target.value || undefined })} placeholder={t('settings.product_name_placeholder')} className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-tiktok-gray-600 mb-1">{t('settings.product_desc')}</label>
            <input type="text" value={settings?.productDescription || ''} onChange={e => onUpdateSetting({ productDescription: e.target.value || undefined })} placeholder={t('settings.product_desc_placeholder')} className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-tiktok-gray-600 mb-1">{t('settings.commission_rate')}</label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="80" value={settings?.commissionRate || settings?.defaultCommission || 15} onChange={e => onUpdateSetting({ commissionRate: parseInt(e.target.value), defaultCommission: parseInt(e.target.value) })} className="input-field text-sm w-20" />
              <span className="text-sm text-tiktok-gray-500">%</span>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-tiktok-gray-100" />

      {/* Tone */}
      <div>
        <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">{t('settings.default_tone')}</label>
        <select value={settings?.defaultTone || 'professional'} onChange={e => onUpdateSetting({ defaultTone: e.target.value as any })} className="input-field text-sm">
          <option value="professional">{t('tone.professional')}</option>
          <option value="casual">{t('tone.casual')}</option>
          <option value="friendly">{t('tone.friendly')}</option>
        </select>
      </div>

      <hr className="border-tiktok-gray-100" />

      {/* Formspree */}
      <div>
        <label className="block text-sm font-medium text-tiktok-gray-700 mb-1">
          {t('settings.formspree_id')} <span className="text-tiktok-gray-400 font-normal">(optional)</span>
        </label>
        <input type="text" value={settings?.formspreeId || ''} onChange={e => onUpdateSetting({ formspreeId: e.target.value.trim() || undefined })} placeholder="e.g. xyzabcde" className="input-field text-sm" />
        <p className="text-xs text-tiktok-gray-400 mt-1">
          {t('settings.formspree_hint')}{' '}
          <a href="https://formspree.io" target="_blank" rel="noopener" className="underline">formspree.io</a>
        </p>
      </div>
    </div>
  );
}
