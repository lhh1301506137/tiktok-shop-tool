import React, { useState } from 'react';
import { UpgradePrompt } from './UpgradePrompt';

interface LimitInfo {
  tier: string;
  current: number;
  limit: number;
}

// TikTok Shop listing character limits
const TIKTOK_LIMITS = {
  title: 255,
  description: 10000,
  bulletPoint: 500,
};

export function ListingTab() {
  const [input, setInput] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);

  async function generate() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setLimitInfo(null);
    try {
      const payload: any = { productInfo: input };
      if (competitorUrl.trim()) {
        payload.competitorUrl = competitorUrl.trim();
      }
      const res = await chrome.runtime.sendMessage({
        type: 'GENERATE_LISTING',
        payload,
      });
      if (res?.limitReached) {
        setLimitInfo({ tier: res.tier, current: res.current, limit: res.limit });
        setError(null);
      } else if ('error' in res) {
        setError(res.error);
      } else {
        setResult(res);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copyAll() {
    if (!result) return;
    const text = [
      `Title: ${result.title}`,
      '',
      `Description:\n${result.description}`,
      '',
      `Key Selling Points:\n${result.bulletPoints?.map((bp: string) => `• ${bp}`).join('\n')}`,
      '',
      `SEO Tags: ${result.seoTags?.join(', ')}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="p-3 space-y-3">
      <div>
        <label className="text-sm font-medium text-tiktok-gray-700 mb-1 block">
          Describe your product
        </label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. Wireless Bluetooth earbuds with noise cancelling, 36-hour battery, IPX5 waterproof, black color, $29.99"
          rows={4}
          className="input-field text-sm resize-none"
        />
        <div className="flex justify-between mt-1">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-brand-primary hover:underline"
          >
            {showAdvanced ? '▼ Hide options' : '▶ Advanced options'}
          </button>
          <span className="text-[10px] text-tiktok-gray-400">{input.length} chars</span>
        </div>
      </div>

      {showAdvanced && (
        <div className="bg-tiktok-gray-50 rounded-lg p-2.5 space-y-2">
          <div>
            <label className="text-[11px] font-medium text-tiktok-gray-600 mb-0.5 block">
              Competitor URL (optional)
            </label>
            <input
              type="text"
              value={competitorUrl}
              onChange={e => setCompetitorUrl(e.target.value)}
              placeholder="https://www.tiktok.com/view/product/..."
              className="input-field text-xs w-full"
            />
            <p className="text-[10px] text-tiktok-gray-400 mt-0.5">
              AI will analyze the competitor and write better copy
            </p>
          </div>
        </div>
      )}

      <button onClick={generate} disabled={loading || !input.trim()} className="btn-primary w-full text-sm">
        {loading ? 'Generating...' : '✨ Generate Listing Copy'}
      </button>

      {limitInfo && (
        <UpgradePrompt
          tier={limitInfo.tier}
          limitType="dailyAiGenerations"
          current={limitInfo.current}
          limit={limitInfo.limit}
        />
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex justify-end">
            <CopyButton text="📋 Copy All" onCopy={copyAll} />
          </div>

          <ResultCard
            label="Title"
            content={result.title}
            charLimit={TIKTOK_LIMITS.title}
          />

          <ResultCard
            label="Description"
            content={result.description}
            charLimit={TIKTOK_LIMITS.description}
            multiline
          />

          <div className="card !p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-tiktok-gray-500">Key Selling Points ({result.bulletPoints?.length || 0})</p>
              <CopyButton
                text="📋"
                onCopy={async () => {
                  await navigator.clipboard.writeText(
                    result.bulletPoints?.map((bp: string) => `• ${bp}`).join('\n') || ''
                  );
                }}
              />
            </div>
            <ul className="text-sm text-tiktok-gray-700 space-y-1.5">
              {result.bulletPoints?.map((bp: string, i: number) => (
                <li key={i} className="flex gap-2 group">
                  <span className="text-brand-primary shrink-0">•</span>
                  <span className="flex-1">{bp}</span>
                  <CharCount text={bp} limit={TIKTOK_LIMITS.bulletPoint} />
                </li>
              ))}
            </ul>
          </div>

          <div className="card !p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-tiktok-gray-500">SEO Tags ({result.seoTags?.length || 0})</p>
              <CopyButton
                text="📋"
                onCopy={async () => {
                  await navigator.clipboard.writeText(result.seoTags?.join(', ') || '');
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {result.seoTags?.map((tag: string, i: number) => (
                <span
                  key={i}
                  className="badge bg-tiktok-blue/10 text-tiktok-dark text-[10px] cursor-pointer hover:bg-tiktok-blue/20 transition-colors"
                  onClick={async () => {
                    await navigator.clipboard.writeText(tag);
                  }}
                  title="Click to copy"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Character count indicator with color coding */
function CharCount({ text, limit }: { text: string; limit: number }) {
  const len = text.length;
  const pct = len / limit;
  const color = pct > 1 ? 'text-red-500' : pct > 0.9 ? 'text-amber-500' : 'text-tiktok-gray-400';
  return (
    <span className={`text-[9px] shrink-0 ${color}`}>
      {len}/{limit}
    </span>
  );
}

/** Reusable copy button with feedback */
function CopyButton({ text, onCopy }: { text: string; onCopy: () => Promise<void> }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={handleCopy}
      className="text-xs text-tiktok-gray-400 hover:text-brand-primary transition-colors"
    >
      {copied ? '✅' : text}
    </button>
  );
}

function ResultCard({
  label,
  content,
  charLimit,
  multiline,
}: {
  label: string;
  content: string;
  charLimit?: number;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card !p-3 group">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <p className="text-xs text-tiktok-gray-500">{label}</p>
          {charLimit && <CharCount text={content} limit={charLimit} />}
        </div>
        <button
          onClick={copy}
          className="text-xs text-tiktok-gray-400 hover:text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? '✅' : '📋'}
        </button>
      </div>
      {multiline ? (
        <p className="text-sm text-tiktok-gray-700 whitespace-pre-wrap">{content}</p>
      ) : (
        <p className="font-semibold text-sm">{content}</p>
      )}
    </div>
  );
}
