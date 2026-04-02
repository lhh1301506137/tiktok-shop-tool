import React, { useState, useMemo, useRef } from 'react';
import { Creator } from '@/types';
import { useVirtualList } from '@/hooks/useVirtualList';

type SortBy = 'gmv' | 'followers' | 'name' | 'sold';

const CARD_HEIGHT = 96; // Fixed height for each creator card (px) — matches card + py-1 wrapper

interface CreatorsTabProps {
  creators: Creator[];
  onGenerateInvite: (c: Creator) => void;
  onBatchInvite?: (creators: Creator[]) => void;
  loading: boolean;
}

export function CreatorsTab({
  creators,
  onGenerateInvite,
  onBatchInvite,
  loading,
}: CreatorsTabProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('gmv');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Extract all unique categories
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    creators.forEach(c => {
      if (c.categories && Array.isArray(c.categories)) {
        c.categories.forEach(cat => cats.add(cat));
      }
    });
    return ['All', ...Array.from(cats).sort()];
  }, [creators]);

  const filtered = useMemo(() => {
    return creators
      .filter(c => {
        const matchesSearch = c.displayName.toLowerCase().includes(search.toLowerCase()) ||
          c.username.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || (c.categories && c.categories.includes(selectedCategory));
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'gmv': return b.gmv30d - a.gmv30d;
          case 'followers': return b.followerCount - a.followerCount;
          case 'name': return a.displayName.localeCompare(b.displayName);
          case 'sold': return (b.itemsSold30d || 0) - (a.itemsSold30d || 0);
          default: return 0;
        }
      });
  }, [creators, search, sortBy, selectedCategory]);

  // Virtual scrolling — only render visible cards
  const { virtualItems, totalHeight } = useVirtualList(scrollContainerRef, {
    itemCount: filtered.length,
    itemHeight: CARD_HEIGHT,
    overscan: 5,
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleExportCSV = () => {
    const selectedCreators = creators.filter(c => selectedIds.has(c.id));
    const headers = ['ID', 'DisplayName', 'Username', 'Followers', 'GMV_30d', 'ItemsSold_30d', 'AvgCommission', 'Categories'];
    const rows = selectedCreators.map(c => [
      c.id,
      c.displayName,
      c.username,
      c.followerCount,
      c.gmv30d,
      c.itemsSold30d || 0,
      c.avgCommission || 0,
      (c.categories || []).join('|')
    ]);
    
    const csvContent = [headers, ...rows].map(e => {
      return e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
    }).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tiktok_creators_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchInvite = () => {
    if (onBatchInvite) {
      const selectedCreators = creators.filter(c => selectedIds.has(c.id));
      onBatchInvite(selectedCreators);
    }
  };

  return (
    <div className="flex flex-col h-full bg-tiktok-gray-50 relative">
      <div className="p-3 space-y-3 bg-white border-b border-tiktok-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search creators..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field text-sm flex-1 h-9"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="input-field text-sm !w-auto !px-2 h-9"
          >
            <option value="gmv">GMV ↓</option>
            <option value="sold">Sold ↓</option>
            <option value="followers">Followers ↓</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        {/* Categories Scroller */}
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-[10px] whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                  : 'bg-white text-tiktok-gray-600 border-tiktok-gray-200 hover:bg-tiktok-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={filtered.length > 0 && selectedIds.size === filtered.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 accent-brand-primary rounded border-tiktok-gray-300"
            />
            <span className="text-[10px] font-bold text-tiktok-gray-500 uppercase tracking-wider group-hover:text-tiktok-gray-700">
              Select All ({filtered.length})
            </span>
          </label>
          <div className="text-[10px] text-tiktok-gray-400 font-medium">
            {filtered.length} creators
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="p-3 pb-24 flex-1 overflow-y-auto"
      >
        {creators.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">👥</p>
            <p className="text-tiktok-gray-500 text-sm">No creators captured yet</p>
            <p className="text-tiktok-gray-400 text-xs mt-1">
              Go to TikTok Seller Center → Find Creators.<br />
              ShopPilot will automatically capture creator data.
            </p>
            <a
              href="https://seller-us.tiktok.com/affiliate/marketplace"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm mt-4 inline-block"
            >
              Open Find Creators
            </a>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-tiktok-gray-500 text-sm">No creators match your filters</p>
            <p className="text-tiktok-gray-400 text-xs mt-1">
              Try adjusting your search or category filter.
            </p>
            <button
              onClick={() => { setSearch(''); setSelectedCategory('All'); }}
              className="text-brand-primary font-semibold text-sm mt-3 hover:underline"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          /* Virtual scrolling container */
          <div style={{ height: totalHeight, position: 'relative' }}>
            {virtualItems.map(({ index, offsetTop }) => {
              const creator = filtered[index];
              if (!creator) return null;
              return (
                <div
                  key={creator.id}
                  style={{
                    position: 'absolute',
                    top: offsetTop,
                    left: 0,
                    right: 0,
                    height: CARD_HEIGHT,
                  }}
                  className="px-0 py-1"
                >
                  <CreatorCard
                    creator={creator}
                    onInvite={() => onGenerateInvite(creator)}
                    loading={loading}
                    isSelected={selectedIds.has(creator.id)}
                    onToggle={() => toggleSelect(creator.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-4 right-4 bg-white border border-tiktok-gray-200 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-3 flex items-center justify-between animate-fade-in z-50 ring-1 ring-black/5">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-tiktok-gray-900">{selectedIds.size} Selected</span>
            <span className="text-[10px] text-tiktok-gray-500">Perform batch action</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 text-xs font-semibold text-tiktok-gray-700 bg-white border border-tiktok-gray-200 rounded-lg hover:bg-tiktok-gray-50 transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={handleBatchInvite}
              className="btn-primary !py-1.5 !px-3 text-xs shadow-sm hover:shadow-md active:scale-95 transition-all"
            >
              Batch Invite
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreatorCard({
  creator,
  onInvite,
  loading,
  isSelected,
  onToggle,
}: {
  creator: Creator;
  onInvite: () => void;
  loading: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`card !p-2.5 transition-all duration-200 group relative border h-full ${isSelected ? 'border-brand-primary bg-brand-primary/[0.02] shadow-sm' : 'border-tiktok-gray-100 hover:border-tiktok-gray-300'}`}>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-4 h-4 accent-brand-primary rounded border-tiktok-gray-300 cursor-pointer flex-shrink-0"
        />
        
        <div className="w-10 h-10 rounded-full bg-tiktok-gray-100 border border-tiktok-gray-200 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
          {creator.avatarUrl ? (
            <img src={creator.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            '👤'
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-bold text-xs text-tiktok-gray-900 truncate">
                {creator.displayName}
              </p>
              {creator.inviteStatus !== 'none' && (
                <span className={`badge text-[8px] px-1 py-0 leading-tight uppercase font-bold ${
                  creator.inviteStatus === 'accepted' ? 'badge-success' :
                  creator.inviteStatus === 'pending' ? 'badge-warning' :
                  'badge-error'
                }`}>
                  {creator.inviteStatus}
                </span>
              )}
            </div>
            <button
              onClick={onInvite}
              disabled={loading}
              className="text-brand-primary font-bold text-[10px] hover:text-brand-dark transition-colors"
            >
              {loading ? '...' : 'AI INVITE'}
            </button>
          </div>
          
          <p className="text-[10px] text-tiktok-gray-500 mb-2 truncate">@{creator.username}</p>
          
          <div className="grid grid-cols-4 gap-2 text-[10px]">
            <div className="flex flex-col">
              <span className="text-tiktok-gray-400 font-medium">GMV</span>
              <span className="font-bold text-tiktok-gray-800">${formatK(creator.gmv30d)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-tiktok-gray-400 font-medium">SOLD</span>
              <span className="font-bold text-tiktok-gray-800">{formatK(creator.itemsSold30d || 0)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-tiktok-gray-400 font-medium">COMM</span>
              <span className="font-bold text-green-600">{creator.avgCommission || 0}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-tiktok-gray-400 font-medium">FANS</span>
              <span className="font-bold text-tiktok-gray-800">{formatK(creator.followerCount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatK(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}
