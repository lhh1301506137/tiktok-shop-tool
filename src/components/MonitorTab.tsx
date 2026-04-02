import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ExternalLink,
  Store,
  Tag
} from 'lucide-react';
import { TrackedProduct } from '@/types';
import { getTrackedProducts, removeTrackedProduct } from '@/utils/storage';
import { clsx } from 'clsx';
import { UpgradePrompt } from './UpgradePrompt';

interface LimitInfo {
  tier: string;
  current: number;
  limit: number;
}

export function MonitorTab() {
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const data = await getTrackedProducts();
    setProducts(data);
  }

  async function handleAddProduct() {
    if (!url) return;
    setLoading(true);
    setError(null);
    setLimitInfo(null);
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'TRACK_PRODUCT', 
        payload: { url } 
      });
      
      if (response?.limitReached) {
        setLimitInfo({ tier: response.tier, current: response.current, limit: response.limit });
      } else if (response.error) {
        setError(response.error);
      } else {
        setUrl('');
        await loadProducts();
      }
    } catch (err) {
      setError('Failed to add product. Make sure the URL is valid.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id: string) {
    await removeTrackedProduct(id);
    await loadProducts();
  }

  async function handleRefresh() {
    setLoading(true);
    // In a real app, this would trigger background scraping for all products
    // For now, we'll simulate a refresh signal to background
    try {
      await chrome.runtime.sendMessage({ type: 'REFRESH_TRACKED_PRODUCTS' });
      // Give it a moment then reload from storage
      setTimeout(loadProducts, 1500);
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  }

  return (
    <div className="flex flex-col h-full bg-tiktok-gray-50">
      {/* Header & Add Input */}
      <div className="p-4 bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            placeholder="Paste TikTok Product URL..."
            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-tiktok-pink/20 focus:border-tiktok-pink"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <button
            onClick={handleAddProduct}
            disabled={loading || !url}
            className="p-2 bg-tiktok-pink text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
        
        {limitInfo && (
          <div className="mb-3">
            <UpgradePrompt
              tier={limitInfo.tier}
              limitType="maxTrackedProducts"
              current={limitInfo.current}
              limit={limitInfo.limit}
              compact
            />
          </div>
        )}

        {error && (
          <div className="mb-3 text-xs text-red-500 bg-red-50 p-2 rounded-md border border-red-100">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center">
          <h3 className="text-xs font-semibold text-tiktok-gray-500 uppercase tracking-wider">
            Tracked Products ({products.length})
          </h3>
          <button 
            onClick={handleRefresh}
            disabled={loading || products.length === 0}
            className={clsx(
              "flex items-center gap-1 text-xs text-tiktok-pink font-medium hover:underline",
              loading && "animate-spin"
            )}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {products.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 bg-tiktok-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-tiktok-gray-400">
              <Tag size={32} />
            </div>
            <p className="text-tiktok-gray-500 font-medium">No products tracked yet</p>
            <p className="text-tiktok-gray-400 text-xs mt-1">
              Add a TikTok Shop product URL to start monitoring price and sales changes.
            </p>
          </div>
        ) : (
          products.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onRemove={() => handleRemove(product.id)} 
            />
          ))
        )}
      </div>
    </div>
  );
}

function ProductCard({ product, onRemove }: { product: TrackedProduct, onRemove: () => void }) {
  const lastPrice = product.priceHistory && product.priceHistory.length > 1 
    ? product.priceHistory[product.priceHistory.length - 2].price 
    : product.price;
  
  const priceDiff = product.price - lastPrice;
  const priceStatus = priceDiff < 0 ? 'down' : priceDiff > 0 ? 'up' : 'stable';

  return (
    <div className="bg-white rounded-xl border border-tiktok-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex p-3 gap-3">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg bg-tiktok-gray-100 flex-shrink-0 overflow-hidden border">
          <img 
            src={product.imageUrl || 'https://via.placeholder.com/64'} 
            alt={product.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-tiktok-black truncate leading-tight mb-1">
            {product.title}
          </h4>
          <div className="flex items-center gap-1 text-xs text-tiktok-gray-500 mb-2">
            <Store size={10} />
            <span className="truncate">{product.shopName}</span>
          </div>
          
          <div className="flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-tiktok-gray-400">Current Price</span>
              <div className="flex items-center gap-1">
                <span className="text-base font-bold text-tiktok-black">${product.price.toFixed(2)}</span>
                {priceStatus === 'down' && <TrendingDown size={14} className="text-green-500" />}
                {priceStatus === 'up' && <TrendingUp size={14} className="text-red-500" />}
                {priceStatus === 'stable' && <Minus size={14} className="text-tiktok-gray-300" />}
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-xs text-tiktok-gray-400">Sales</span>
              <span className="text-sm font-semibold text-tiktok-black">{product.salesCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="bg-tiktok-gray-50 px-3 py-2 border-t flex justify-between items-center">
        <div className="text-[10px] text-tiktok-gray-400 italic">
          Last checked: {new Date(product.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => window.open(product.shopUrl || '#', '_blank')}
            className="p-1.5 text-tiktok-gray-400 hover:text-tiktok-pink transition-colors"
            title="View product"
          >
            <ExternalLink size={14} />
          </button>
          <button 
            onClick={onRemove}
            className="p-1.5 text-tiktok-gray-400 hover:text-red-500 transition-colors"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
