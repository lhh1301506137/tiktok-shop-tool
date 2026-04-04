/**
 * ShopPilot - Background Service Worker
 * Handles messaging, alarms, and side panel management
 *
 * NOTE: Use static imports only — dynamic import() causes Vite to inject
 * modulepreload polyfill that uses `document`/`window`, which don't exist
 * in Service Workers.
 */

import { MessageType, TrackedProduct } from '@/types';
import { 
  getSettings, 
  updateSettings, 
  getTrackedProducts, 
  addTrackedProduct, 
  updateTrackedProduct,
  incrementUsage,
  addAIHistory,
  deleteAIHistory,
  getAIHistory,
  checkDailyAILimit,
  checkDailyInviteLimit,
  checkTrackedProductLimit,
  checkSavedCreatorLimit,
  saveCreators,
  LimitCheckResult,
} from '@/utils/storage';
import { generateInviteMessage, generateListingCopy } from '@/services/ai';
import { startBatchInvite, stopBatchInvite, getQueueState, recoverQueue } from '@/services/inviteQueue';

// ---- Tier Limit Helpers ----

function limitReachedError(check: LimitCheckResult): { error: string; limitReached: true; tier: string; current: number; limit: number } {
  const limitNames: Record<string, string> = {
    dailyInvites: 'daily invites',
    dailyAiGenerations: 'daily AI generations',
    maxTrackedProducts: 'tracked products',
    maxSavedCreators: 'saved creators',
  };
  const name = limitNames[check.limitType] || check.limitType;
  return {
    error: `You've reached the ${check.tier.toUpperCase()} plan limit of ${check.limit} ${name}. Upgrade to unlock more!`,
    limitReached: true,
    tier: check.tier,
    current: check.current,
    limit: check.limit,
  };
}

// ---- Side Panel ----

// Open side panel when extension icon is clicked (if on TikTok Seller page)
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && tab.url?.includes('seller') && tab.url?.includes('tiktok.com')) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ---- Message Router ----

chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => {
      console.error('[ShopPilot] Message handler error:', err);
      sendResponse({ error: String(err) });
    });
  return true; // Keep message channel open for async response
});

async function handleMessage(message: MessageType) {
  switch (message.type) {
    case 'OPEN_SIDEPANEL': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
      return { success: true };
    }

    case 'GET_SETTINGS': {
      return await getSettings();
    }

    case 'UPDATE_SETTINGS': {
      return await updateSettings(message.payload);
    }

    case 'GENERATE_INVITE': {
      // Check AI generation limit
      const aiCheck = await checkDailyAILimit();
      if (!aiCheck.allowed) return limitReachedError(aiCheck);

      // Load seller's product info from settings
      const inviteSettings = await getSettings();
      const sellerProduct = inviteSettings.productName
        ? { name: inviteSettings.productName, description: inviteSettings.productDescription, commission: inviteSettings.commissionRate }
        : undefined;

      const inviteResult = await generateInviteMessage(
        message.payload.creator,
        message.payload.tone as any,
        undefined,
        sellerProduct,
      );
      // Save to AI history & increment usage
      if (!('error' in inviteResult)) {
        await incrementUsage('aiGenerationsToday');
        await addAIHistory({
          type: 'invite',
          input: `${message.payload.creator.displayName} (@${message.payload.creator.username})`,
          output: inviteResult.body,
          metadata: { tone: message.payload.tone, creatorId: message.payload.creator.id },
        });
      }
      return inviteResult;
    }

    case 'GENERATE_LISTING': {
      // Check AI generation limit
      const listingAiCheck = await checkDailyAILimit();
      if (!listingAiCheck.allowed) return limitReachedError(listingAiCheck);

      const listingResult = await generateListingCopy(message.payload.productInfo);
      // Save to AI history & increment usage
      if (!('error' in listingResult)) {
        await incrementUsage('aiGenerationsToday');
        await addAIHistory({
          type: 'listing',
          input: message.payload.productInfo,
          output: JSON.stringify(listingResult),
          metadata: { title: listingResult.title },
        });
      }
      return listingResult;
    }

    case 'TRACK_PRODUCT': {
      // Check tracked product limit
      const productLimitCheck = await checkTrackedProductLimit();
      if (!productLimitCheck.allowed) return limitReachedError(productLimitCheck);

      const { url, productInfo } = message.payload;
      const products = await getTrackedProducts();
      
      if (products.some(p => p.shopUrl === url)) {
        return { error: 'Product is already being tracked' };
      }

      const newProduct: TrackedProduct = {
        id: productInfo?.id || Date.now().toString(),
        title: productInfo?.title || 'Unknown Product',
        price: productInfo?.price || 0,
        imageUrl: productInfo?.imageUrl || '',
        shopName: productInfo?.shopName || 'Unknown Shop',
        shopUrl: url,
        salesCount: productInfo?.salesCount || 0,
        rating: 0,
        priceHistory: productInfo?.price ? [{ price: productInfo.price, timestamp: Date.now() }] : [],
        addedAt: Date.now(),
        lastChecked: Date.now(),
      };

      await addTrackedProduct(newProduct);
      await incrementUsage('productsTracked');
      return { success: true };
    }

    case 'REFRESH_TRACKED_PRODUCTS': {
      await refreshAllTrackedProducts();
      return { success: true };
    }

    case 'BATCH_INVITE': {
      // Check invite limit before starting batch
      const batchInviteCheck = await checkDailyInviteLimit();
      if (!batchInviteCheck.allowed) return limitReachedError(batchInviteCheck);

      const result = await startBatchInvite(
        message.payload.creators,
        message.payload.tone
      );
      return result;
    }

    case 'STOP_BATCH_INVITE': {
      stopBatchInvite();
      return { success: true };
    }

    case 'GET_INVITE_QUEUE': {
      return getQueueState();
    }

    case 'AUTOFILL_INVITE': {
      // Forward to content script on the active TikTok tab
      const tabs = await chrome.tabs.query({ url: '*://seller*.tiktok.com/*' });
      if (tabs.length > 0 && tabs[0].id) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'AUTOFILL_INVITE',
          payload: message.payload,
        });
        return { success: true };
      }
      return { error: 'No TikTok Seller Center tab found. Please open it first.' };
    }

    case 'GET_AI_HISTORY': {
      return await getAIHistory(message.payload?.type);
    }

    case 'DELETE_AI_HISTORY': {
      await deleteAIHistory(message.payload.id);
      return { success: true };
    }

    case 'CREATORS_DATA': {
      // Persist captured creators to chunked storage
      const incomingCreators = (message as any).payload;
      if (Array.isArray(incomingCreators) && incomingCreators.length > 0) {
        await saveCreators(incomingCreators);
        console.log(`[ShopPilot] Persisted ${incomingCreators.length} creators to storage`);
      }
      return { success: true };
    }

    case 'CHECK_LIMITS': {
      const [invites, aiGens, products, creators] = await Promise.all([
        checkDailyInviteLimit(),
        checkDailyAILimit(),
        checkTrackedProductLimit(),
        checkSavedCreatorLimit(),
      ]);
      return { invites, aiGens, products, creators };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// ---- Alarms for periodic tasks ----

chrome.alarms.create('daily-reset', { periodInMinutes: 60 });
chrome.alarms.create('price-check', { periodInMinutes: 360 }); // every 6 hours

async function refreshAllTrackedProducts() {
  const products = await getTrackedProducts();
  if (products.length === 0) return;

  console.log(`[ShopPilot] Refreshing ${products.length} tracked products...`);

  for (const product of products) {
    try {
      // Create a hidden tab to load the product page
      const tab = await chrome.tabs.create({
        url: product.shopUrl,
        active: false,
      });

      if (!tab.id) continue;

      // Wait for the page to fully load
      await waitForTabLoad(tab.id);

      // Wait extra time for SPA content to render
      await new Promise(r => setTimeout(r, 3000));

      // Request data from the content script in that tab
      try {
        const update = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PRODUCT_DATA' });

        if (update && !update.error) {
          const oldPrice = product.price;
          const oldSales = product.salesCount;

          await updateTrackedProduct(product.id, {
            title: update.title || product.title,
            price: update.price || product.price,
            salesCount: update.salesCount ?? product.salesCount,
            shopName: update.shopName || product.shopName,
            imageUrl: update.imageUrl || product.imageUrl,
            lastChecked: Date.now(),
          });

          // Notify on significant price drop (>5%)
          if (update.price > 0 && oldPrice > 0 && update.price < oldPrice * 0.95) {
            chrome.notifications.create(`price-drop-${product.id}`, {
              type: 'basic',
              iconUrl: '/icons/icon128.png',
              title: '📉 Price Drop Alert!',
              message: `${product.title}\n$${oldPrice.toFixed(2)} → $${update.price.toFixed(2)} (${((1 - update.price / oldPrice) * 100).toFixed(0)}% off)`,
              priority: 2,
            });
          }

          // Notify on sales spike (>20% increase)
          if (update.salesCount > 0 && oldSales > 0 && update.salesCount > oldSales * 1.2) {
            chrome.notifications.create(`sales-spike-${product.id}`, {
              type: 'basic',
              iconUrl: '/icons/icon128.png',
              title: '🔥 Sales Spike!',
              message: `${product.title}\nSales jumped from ${oldSales} to ${update.salesCount}`,
              priority: 1,
            });
          }

          console.log(`[ShopPilot] Updated: ${product.title} — $${update.price}, ${update.salesCount} sales`);
        }
      } catch (scrapeErr) {
        console.warn(`[ShopPilot] Failed to scrape ${product.title}:`, scrapeErr);
      }

      // Close the hidden tab (may already be closed by user)
      try { await chrome.tabs.remove(tab.id); } catch { /* tab already closed */ }

      // Rate limit: wait between products to avoid triggering anti-bot
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

    } catch (err) {
      console.error(`[ShopPilot] Error refreshing ${product.title}:`, err);
    }
  }

  console.log('[ShopPilot] All tracked products refreshed');
}

/** Wait for a tab to finish loading */
function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const cleanup = () => {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(updateListener);
      chrome.tabs.onRemoved.removeListener(removeListener);
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve(); // Resolve anyway after timeout
    }, 15000);

    function updateListener(updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        cleanup();
        resolve();
      }
    }

    function removeListener(removedTabId: number) {
      if (removedTabId === tabId) {
        cleanup();
        resolve(); // Tab was closed before load completed
      }
    }

    chrome.tabs.onUpdated.addListener(updateListener);
    chrome.tabs.onRemoved.addListener(removeListener);
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-reset') {
    // Usage stats auto-reset is handled in getUsage()
    console.log('[ShopPilot] Daily reset check');
  }

  if (alarm.name === 'price-check') {
    console.log('[ShopPilot] Price check alarm triggered');
    await refreshAllTrackedProducts();
  }
});

// ---- Install/Update ----

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[ShopPilot] Extension installed');
    // Set default settings
    await updateSettings({
      tier: 'free',
      aiProvider: 'deepseek',
      defaultCommission: 15,
      defaultTone: 'professional',
      language: 'en',
      theme: 'light',
    });
  }
});

// ---- Recover interrupted batch queue on SW restart ----

recoverQueue().then(recovered => {
  if (recovered) {
    console.log('[ShopPilot] Resumed interrupted batch invite queue');
  }
});

console.log('[ShopPilot] Background service worker started');
