import React, { useEffect, useState } from 'react';
import { Creator, InviteMessage } from '@/types';

type Tone = 'professional' | 'friendly' | 'casual';

export function InviteTab({
  creator,
  message,
  onRegenerate,
  loading,
  onChangeTone,
}: {
  creator: Creator | null;
  message: InviteMessage | null;
  onRegenerate: () => void;
  loading: boolean;
  onChangeTone: (tone: Tone) => void;
}) {
  const [editedBody, setEditedBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [tone, setTone] = useState<Tone>('professional');

  useEffect(() => {
    if (message) setEditedBody(message.body);
  }, [message]);

  if (!creator || !message) {
    return (
      <div className="p-3 text-center py-12">
        <p className="text-3xl mb-3">✉️</p>
        <p className="text-tiktok-gray-500 text-sm">Select a creator and click "AI Invite"</p>
      </div>
    );
  }

  async function copyAndOpen() {
    if (!creator) return;
    // 1. Try to autofill if a tab is already open
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AUTOFILL_INVITE',
        payload: {
          creatorId: creator.id,
          message: editedBody
        }
      });

      if (response && response.success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch (e) {
      console.warn('[ShopPilot] Autofill failed, falling back to clipboard:', e);
    }

    // 2. Fallback: Copy to clipboard and open new tab
    await navigator.clipboard.writeText(editedBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Open TikTok seller center messages
    window.open('https://seller-us.tiktok.com/im', '_blank');
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(editedBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleToneChange(newTone: Tone) {
    setTone(newTone);
    onChangeTone(newTone);
  }

  return (
    <div className="p-3 space-y-3">
      <div className="card !p-3">
        <p className="text-xs text-tiktok-gray-500 mb-1">Invitation for</p>
        <p className="font-semibold text-sm">{creator.displayName} (@{creator.username})</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-tiktok-gray-700">Message</label>
          <div className="flex items-center gap-2">
            <select
              value={tone}
              onChange={e => handleToneChange(e.target.value as Tone)}
              className="text-xs border border-tiktok-gray-200 rounded px-1.5 py-0.5"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="casual">Casual</option>
            </select>
            <button
              onClick={onRegenerate}
              disabled={loading}
              className="text-xs text-brand-primary hover:underline"
            >
              {loading ? 'Generating...' : '🔄 Regenerate'}
            </button>
          </div>
        </div>
        <textarea
          value={editedBody}
          onChange={e => setEditedBody(e.target.value)}
          rows={10}
          className="input-field text-sm resize-none"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={copyToClipboard} className="btn-secondary flex-1 text-sm">
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
        <button onClick={copyAndOpen} className="btn-primary flex-1 text-sm">
          📤 Copy & Open TikTok
        </button>
      </div>
    </div>
  );
}
