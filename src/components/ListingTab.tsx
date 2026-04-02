import React, { useState } from 'react';
import { UpgradePrompt } from './UpgradePrompt';

interface LimitInfo {
  tier: string;
  current: number;
  limit: number;
}

export function ListingTab() {
  const [input, setInput] = useState('');
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
      const res = await chrome.runtime.sendMessage({
        type: 'GENERATE_LISTING',
        payload: { productInfo: input },
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
      </div>

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
            <button onClick={copyAll} className="text-xs text-brand-primary hover:underline">
              📋 Copy All
            </button>
          </div>

          <ResultCard label="Title" content={result.title} />

          <div className="card !p-3">
            <p className="text-xs text-tiktok-gray-500 mb-1">Description</p>
            <p className="text-sm text-tiktok-gray-700 whitespace-pre-wrap">{result.description}</p>
          </div>

          <div className="card !p-3">
            <p className="text-xs text-tiktok-gray-500 mb-1">Key Selling Points</p>
            <ul className="text-sm text-tiktok-gray-700 space-y-1">
              {result.bulletPoints?.map((bp: string, i: number) => (
                <li key={i} className="flex gap-2">
                  <span className="text-brand-primary">•</span>
                  {bp}
                </li>
              ))}
            </ul>
          </div>

          <div className="card !p-3">
            <p className="text-xs text-tiktok-gray-500 mb-1">SEO Tags</p>
            <div className="flex flex-wrap gap-1">
              {result.seoTags?.map((tag: string, i: number) => (
                <span key={i} className="badge bg-tiktok-blue/10 text-tiktok-dark text-[10px]">
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

function ResultCard({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card !p-3 group">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-tiktok-gray-500">{label}</p>
        <button
          onClick={copy}
          className="text-xs text-tiktok-gray-400 hover:text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? '✅' : '📋'}
        </button>
      </div>
      <p className="font-semibold text-sm">{content}</p>
    </div>
  );
}
