import React, { useState } from 'react';

type FeedbackType = 'bug' | 'feature' | 'general';

interface FeedbackEntry {
  id: string;
  type: FeedbackType;
  message: string;
  rating?: number;
  createdAt: number;
  version: string;
}

const FEEDBACK_LABELS: Record<FeedbackType, { label: string; emoji: string }> = {
  bug: { label: 'Bug Report', emoji: '🐛' },
  feature: { label: 'Feature Request', emoji: '💡' },
  general: { label: 'General', emoji: '💬' },
};

export function FeedbackWidget({ onClose }: { onClose?: () => void }) {
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!message.trim()) return;
    setSaving(true);

    const entry: FeedbackEntry = {
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      message: message.trim(),
      rating: rating > 0 ? rating : undefined,
      createdAt: Date.now(),
      version: '0.3.0',
    };

    try {
      // 1) Always save locally
      const result = await chrome.storage.local.get('feedback');
      const existing: FeedbackEntry[] = result.feedback || [];
      existing.unshift(entry);
      await chrome.storage.local.set({ feedback: existing.slice(0, 50) });

      // 2) Submit to Formspree if configured (fire-and-forget)
      const settings = await chrome.storage.local.get('settings');
      const formspreeId = settings?.settings?.formspreeId;
      if (formspreeId) {
        fetch(`https://formspree.io/f/${formspreeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            type: entry.type,
            message: entry.message,
            rating: entry.rating,
            version: entry.version,
            timestamp: new Date(entry.createdAt).toISOString(),
          }),
        }).catch(() => {
          // Silent fail — local copy is the source of truth
          console.log('[ShopPilot] Formspree submission failed (offline?), feedback saved locally');
        });
      }

      setSubmitted(true);
    } catch (e) {
      console.error('[ShopPilot] Feedback save error:', e);
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-6">
        <p className="text-2xl mb-2">🎉</p>
        <p className="text-sm font-semibold text-tiktok-gray-900">Thank you!</p>
        <p className="text-xs text-tiktok-gray-500 mt-1">Your feedback helps us improve ShopPilot.</p>
        {onClose && (
          <button onClick={onClose} className="btn-secondary text-xs mt-3">
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-tiktok-gray-900">Send Feedback</h3>
        {onClose && (
          <button onClick={onClose} className="text-tiktok-gray-400 hover:text-tiktok-gray-600 text-xs">
            ✕
          </button>
        )}
      </div>

      {/* Type Selector */}
      <div className="flex gap-1">
        {(Object.keys(FEEDBACK_LABELS) as FeedbackType[]).map(key => (
          <button
            key={key}
            onClick={() => setType(key)}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
              type === key
                ? 'bg-brand-primary/10 text-brand-primary border-brand-primary'
                : 'bg-white text-tiktok-gray-600 border-tiktok-gray-200 hover:bg-tiktok-gray-50'
            }`}
          >
            {FEEDBACK_LABELS[key].emoji} {FEEDBACK_LABELS[key].label}
          </button>
        ))}
      </div>

      {/* Message */}
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder={
          type === 'bug' ? 'Describe what happened and what you expected...'
          : type === 'feature' ? 'What feature would you like to see?'
          : 'Share your thoughts...'
        }
        rows={3}
        className="input-field text-sm resize-none"
      />

      {/* Rating */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-tiktok-gray-500">Rate your experience:</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRating(rating === star ? 0 : star)}
              className={`text-lg transition-colors ${
                star <= rating ? 'text-yellow-400' : 'text-tiktok-gray-200 hover:text-yellow-300'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving || !message.trim()}
        className="btn-primary w-full text-sm"
      >
        {saving ? 'Sending...' : 'Send Feedback'}
      </button>
    </div>
  );
}
