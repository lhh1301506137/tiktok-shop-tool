import React, { useEffect, useState } from 'react';
import { Creator, InviteMessage, InviteTemplate } from '@/types';
import { getInviteTemplates, saveInviteTemplate, deleteInviteTemplate, incrementTemplateUseCount } from '@/utils/storage';

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
  const [templates, setTemplates] = useState<InviteTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => {
    if (message) setEditedBody(message.body);
  }, [message]);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const tpls = await getInviteTemplates();
    setTemplates(tpls);
  }

  async function handleSaveTemplate() {
    if (!editedBody.trim() || !templateName.trim()) return;
    setSavingTemplate(true);
    await saveInviteTemplate({
      name: templateName.trim(),
      body: editedBody,
      tone,
    });
    await loadTemplates();
    setSavingTemplate(false);
    setShowSaveForm(false);
    setTemplateName('');
  }

  async function handleLoadTemplate(tpl: InviteTemplate) {
    setEditedBody(tpl.body);
    setTone(tpl.tone);
    await incrementTemplateUseCount(tpl.id);
    await loadTemplates();
    setShowTemplates(false);
  }

  async function handleDeleteTemplate(id: string) {
    await deleteInviteTemplate(id);
    await loadTemplates();
  }

  if (!creator || !message) {
    return (
      <div className="p-3 text-center py-12">
        <p className="text-3xl mb-3">✉️</p>
        <p className="text-tiktok-gray-500 text-sm">Select a creator and click "AI Invite"</p>
        {/* Show templates even without active message */}
        {templates.length > 0 && (
          <div className="mt-6 text-left">
            <p className="text-xs font-medium text-tiktok-gray-600 mb-2">Saved Templates ({templates.length})</p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {templates.map(tpl => (
                <div key={tpl.id} className="border border-tiktok-gray-200 rounded p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-tiktok-gray-700">{tpl.name}</span>
                    <span className="text-tiktok-gray-400">used {tpl.useCount}x</span>
                  </div>
                  <p className="text-tiktok-gray-500 line-clamp-2">{tpl.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  async function copyAndOpen() {
    if (!creator) return;
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

    await navigator.clipboard.writeText(editedBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      {/* Template Actions Row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setShowSaveForm(!showSaveForm); setShowTemplates(false); }}
          className="text-xs text-brand-primary hover:underline flex items-center gap-1"
        >
          💾 Save as Template
        </button>
        {templates.length > 0 && (
          <button
            onClick={() => { setShowTemplates(!showTemplates); setShowSaveForm(false); }}
            className="text-xs text-brand-primary hover:underline flex items-center gap-1"
          >
            📂 Templates ({templates.length})
          </button>
        )}
      </div>

      {/* Save Template Form */}
      {showSaveForm && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-2.5 space-y-2">
          <input
            type="text"
            placeholder="Template name (e.g. 'Beauty product outreach')"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="input-field text-xs w-full"
            maxLength={50}
            onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="btn-primary text-xs flex-1"
            >
              {savingTemplate ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowSaveForm(false)} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      {showTemplates && (
        <div className="border border-tiktok-gray-200 rounded-lg max-h-48 overflow-y-auto">
          {templates.map(tpl => (
            <div key={tpl.id} className="p-2.5 border-b border-tiktok-gray-100 last:border-b-0 hover:bg-tiktok-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-tiktok-gray-700 truncate flex-1">{tpl.name}</span>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className="text-[10px] text-tiktok-gray-400 bg-tiktok-gray-100 rounded px-1.5 py-0.5">
                    {tpl.tone} · {tpl.useCount}x
                  </span>
                  <button
                    onClick={() => handleLoadTemplate(tpl)}
                    className="text-[11px] text-brand-primary hover:underline font-medium"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="text-[11px] text-red-500 hover:underline"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-tiktok-gray-500 line-clamp-2">{tpl.body}</p>
            </div>
          ))}
        </div>
      )}

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
