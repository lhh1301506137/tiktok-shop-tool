import React, { useEffect, useState } from 'react';
import { ReferralInfo, REFERRAL_REWARDS } from '@/types';

export function ReferralSection() {
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_REFERRAL' }).then((info: ReferralInfo) => {
      setReferral(info);
    }).catch(() => {});
  }, []);

  const shareUrl = referral
    ? `${REFERRAL_REWARDS.SHARE_URL_BASE}?ref=${referral.myCode}`
    : '';

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select and copy
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleApplyCode() {
    if (!codeInput.trim()) return;
    setApplying(true);
    setResultMsg(null);

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'APPLY_REFERRAL_CODE',
        payload: { code: codeInput.trim() },
      });
      setResultMsg({ ok: result.success, text: result.message });
      if (result.success) {
        // Refresh referral info
        const updated = await chrome.runtime.sendMessage({ type: 'GET_REFERRAL' });
        setReferral(updated);
        setCodeInput('');
      }
    } catch (e) {
      setResultMsg({ ok: false, text: (e as Error).message });
    } finally {
      setApplying(false);
    }
  }

  if (!referral) return null;

  const totalBonus = referral.bonusAiCredits + referral.refereeBonus;

  return (
    <div className="border border-tiktok-gray-200 rounded-lg p-3 space-y-3">
      <h3 className="text-sm font-semibold text-tiktok-gray-700 flex items-center gap-1.5">
        🎁 Refer & Earn
      </h3>

      {/* My referral code + share */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 space-y-2">
        <p className="text-[11px] text-blue-700">
          Share your code. Each friend who joins gives you <strong>{REFERRAL_REWARDS.CREDITS_PER_REFERRAL} bonus AI credits</strong> (max {REFERRAL_REWARDS.MAX_REFERRAL_BONUS}).
        </p>
        <div className="flex items-center gap-1.5">
          <code className="bg-white border border-blue-200 rounded px-2 py-1 text-sm font-mono font-bold text-blue-800 flex-1 text-center select-all">
            {referral.myCode}
          </code>
          <button
            onClick={handleCopy}
            className="btn-primary text-xs !py-1 !px-2.5 shrink-0"
          >
            {copied ? '✓ Copied' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 text-center">
        <div className="flex-1 bg-tiktok-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold text-tiktok-gray-900">{referral.referralCount}</p>
          <p className="text-[10px] text-tiktok-gray-500">Referrals</p>
        </div>
        <div className="flex-1 bg-tiktok-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold text-green-600">+{totalBonus}</p>
          <p className="text-[10px] text-tiktok-gray-500">Bonus Credits</p>
        </div>
      </div>

      {/* Apply code (if not already applied) */}
      {referral.appliedCode ? (
        <div className="bg-green-50 border border-green-200 rounded p-2">
          <p className="text-green-700 text-xs">
            ✅ Friend's code applied: <strong>{referral.appliedCode}</strong> — you got +{referral.refereeBonus} bonus credits!
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-tiktok-gray-600 mb-1">
            Have a friend's code?
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="SP-XXXXXX"
              maxLength={9}
              className="input-field text-xs flex-1 font-mono"
              onKeyDown={e => e.key === 'Enter' && handleApplyCode()}
            />
            <button
              onClick={handleApplyCode}
              disabled={applying || !codeInput.trim()}
              className="btn-primary text-xs !py-1 !px-2.5 shrink-0"
            >
              {applying ? '...' : 'Apply'}
            </button>
          </div>
          <p className="text-[10px] text-tiktok-gray-400 mt-0.5">
            Get {REFERRAL_REWARDS.REFEREE_BONUS} free AI credits when you enter a friend's code
          </p>
        </div>
      )}

      {/* Result message */}
      {resultMsg && (
        <p className={`text-[11px] ${resultMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
          {resultMsg.ok ? '✅' : '❌'} {resultMsg.text}
        </p>
      )}
    </div>
  );
}
