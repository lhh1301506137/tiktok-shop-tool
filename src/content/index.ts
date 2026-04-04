/**
 * ShopPilot - Content Script (ISOLATED world)
 * Bridge between injected MAIN world script and extension background.
 * Handles: chrome messaging, UI injection, DOM scraping, action automation.
 */

import { Creator } from '@/types';

// ---- Constants ----

const SP_SOURCE_INJECTED = 'shoppilot-injected';
const SP_SOURCE_BRIDGE = 'shoppilot-bridge';

const AFFILIATE_PATHS = [
  '/affiliate/marketplace',
  '/affiliate/find-creators',
  '/affiliate/creator-management',
  '/affiliate/collaboration/target',
];

// ---- State ----

const capturedCreators: Creator[] = [];

// ---- Bridge: Listen to MAIN world postMessage ----

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== SP_SOURCE_INJECTED) return;

  switch (event.data.type) {
    case 'CREATORS_RAW_DATA':
      processCreatorData(event.data.payload);
      break;
    case 'PONG':
      console.log('[ShopPilot] MAIN world interceptor confirmed active');
      break;
  }
});

// ---- Data Processing ----

function processCreatorData(rawData: any) {
  try {
    const creatorList =
      rawData?.data?.creators ||
      rawData?.data?.list ||
      rawData?.data?.creator_list ||
      rawData?.creators ||
      [];

    if (!Array.isArray(creatorList) || creatorList.length === 0) return;

    const creators: Creator[] = creatorList.map((raw: any) => ({
      id: raw.creator_id || raw.id || raw.user_id || '',
      username: raw.unique_id || raw.username || raw.nickname || '',
      displayName: raw.display_name || raw.nickname || raw.name || '',
      avatarUrl: raw.avatar_url || raw.avatar || raw.profile_image || '',
      followerCount: raw.follower_count || raw.fans_count || 0,
      videoCount: raw.video_count || 0,
      gmv30d: raw.gmv_30d || raw.gmv || raw.total_gmv || 0,
      itemsSold30d: raw.items_sold_30d || raw.sold_count || 0,
      avgCommission: raw.avg_commission_rate || raw.commission_rate || 0,
      categories: raw.categories || raw.category_list || [],
      email: raw.email || raw.contact_email,
      contactInfo: raw.contact_info,
      inviteStatus: 'none' as const,
      lastUpdated: Date.now(),
    }));

    capturedCreators.push(...creators);
    chrome.runtime.sendMessage({
      type: 'CREATORS_DATA',
      payload: creators,
    });

    console.log(`[ShopPilot] Captured ${creators.length} creators via MAIN world interception`);
  } catch (e) {
    console.error('[ShopPilot] Error processing creator data:', e);
  }
}

// ---- UI Injection ----

function injectToolbar() {
  if (document.getElementById('shoppilot-host')) return;

  const host = document.createElement('div');
  host.id = 'shoppilot-host';
  host.style.cssText = 'position: fixed; z-index: 99999; bottom: 0; right: 0; pointer-events: none;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      :host { all: initial; }
      
      .sp-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-end;
        pointer-events: auto;
        font-family: Inter, system-ui, -apple-system, sans-serif;
      }
      
      .sp-status {
        background: #1C1C1E;
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: none;
        animation: fadeIn 0.2s ease-out;
        max-width: 280px;
      }
      
      .sp-fab {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #FE2C55, #25F4EE);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(254, 44, 85, 0.4);
        transition: transform 0.2s, box-shadow 0.2s;
        font-size: 20px;
        pointer-events: auto;
      }
      
      .sp-fab:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(254, 44, 85, 0.5);
      }
      
      .sp-fab:active {
        transform: scale(0.95);
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
    <div class="sp-container">
      <div class="sp-status" id="sp-status"></div>
      <button class="sp-fab" id="sp-fab" title="ShopPilot">🚀</button>
    </div>
  `;

  const fab = shadow.getElementById('sp-fab');
  fab?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
  });

  // Store shadow root reference for showStatus to use
  (window as any).__shoppilotShadow = shadow;
}

let _statusTimer: ReturnType<typeof setTimeout> | null = null;
function showStatus(message: string, duration: number = 3000) {
  const shadow = (window as any).__shoppilotShadow;
  if (!shadow) return;
  const status = shadow.getElementById('sp-status');
  if (!status) return;
  if (_statusTimer) clearTimeout(_statusTimer);
  status.textContent = `🚀 ${message}`;
  status.style.display = 'block';
  _statusTimer = setTimeout(() => {
    status.style.display = 'none';
    _statusTimer = null;
  }, duration);
}

// ---- Page Observer ----

function onPageChange() {
  const path = window.location.pathname;
  const isAffiliatePage = AFFILIATE_PATHS.some(p => path.includes(p));

  if (isAffiliatePage) {
    showStatus(`Monitoring creator data... Keep scrolling to capture more!`);
  }

  if (path.includes('/view/product/')) {
    injectTrackButton();
  }
}

// ---- Multi-Strategy DOM Selector System ----

interface SelectorStrategy {
  name: string;
  selectors: string[];
  textPattern?: RegExp;        // Fallback: match by visible text content
  attributePattern?: string;   // Fallback: match by attribute content
}

const SELECTOR_STRATEGIES: Record<string, SelectorStrategy> = {
  title: {
    name: 'Product Title',
    selectors: [
      '.product-info-title',
      '[data-testid="product-title"]',
      'h1[class*="Title"]',
      'h1[class*="title"]',
      '[class*="product"][class*="name"]',
      '[class*="product"][class*="title"]',
      'h1',
    ],
  },
  price: {
    name: 'Product Price',
    selectors: [
      '.product-info-price',
      '[data-testid="product-price"]',
      '[class*="Price"]:not([class*="original"]):not([class*="Origin"])',
      '[class*="price"]:not([class*="original"]):not([class*="origin"])',
      '[class*="salePrice"]',
      '[class*="currentPrice"]',
    ],
    textPattern: /[\$\£\€]\s?\d+[\.,]?\d*/,
  },
  sales: {
    name: 'Sales Count',
    selectors: [
      '.product-info-sales',
      '[data-testid="product-sales"]',
      '[class*="Sales"]',
      '[class*="sales"]',
      '[class*="sold"]',
      '[class*="Sold"]',
    ],
    textPattern: /[\d,.]+[kK]?\+?\s*(sold|sales|件)/i,
  },
  shopName: {
    name: 'Shop Name',
    selectors: [
      '.shop-name',
      '[data-testid="shop-name"]',
      '[class*="ShopName"]',
      '[class*="shopName"]',
      '[class*="shop-name"]',
      '[class*="storeName"]',
      '[class*="store-name"]',
      'a[href*="/shop/"]',
    ],
  },
  image: {
    name: 'Product Image',
    selectors: [
      '.product-info-image img',
      '[data-testid="product-image"]',
      'img[class*="MainImage"]',
      'img[class*="mainImage"]',
      'img[class*="product"][class*="image"]',
      'img[src*="tiktokcdn"]',
      'img[src*="tiktokstatic"]',
    ],
  },
};

/**
 * Try multiple selector strategies in order.
 * Strategy chain: CSS selectors → text pattern matching → attribute fallback → meta tags
 */
function queryWithStrategy(strategy: SelectorStrategy): Element | null {
  // Strategy 1: Direct CSS selectors
  for (const selector of strategy.selectors) {
    try {
      const el = document.querySelector(selector);
      if (el && el.textContent?.trim()) return el;
    } catch {
      // Invalid selector, skip
    }
  }

  // Strategy 2: Text pattern matching (walk visible text nodes)
  if (strategy.textPattern) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const el = node as Element;
          const text = el.textContent?.trim() || '';
          if (text && strategy.textPattern!.test(text) && el.children.length < 3) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );
    const match = walker.nextNode();
    if (match) return match as Element;
  }

  return null;
}

/** Track which selectors failed for diagnostic reporting */
const selectorFailures: Record<string, number> = {};

function reportSelectorHealth() {
  const failures = Object.entries(selectorFailures).filter(([, count]) => count > 3);
  if (failures.length > 0) {
    console.warn('[ShopPilot] Selector health report — frequent failures:', failures);
    // Notify background for potential remote reporting
    chrome.runtime.sendMessage({
      type: 'SELECTOR_HEALTH',
      payload: { failures: selectorFailures, url: window.location.href, timestamp: Date.now() },
    }).catch(() => { /* ignore if background not ready */ });
  }
}

// Report selector health every 5 minutes
setInterval(reportSelectorHealth, 5 * 60 * 1000);

// ---- Product Scraper ----

function scrapeProductInfo() {
  try {
    // Title
    const titleEl = queryWithStrategy(SELECTOR_STRATEGIES.title);
    if (!titleEl) selectorFailures['title'] = (selectorFailures['title'] || 0) + 1;
    const title = (titleEl?.textContent || document.title || 'Unknown Product').trim();

    // Price
    const priceEl = queryWithStrategy(SELECTOR_STRATEGIES.price);
    if (!priceEl) selectorFailures['price'] = (selectorFailures['price'] || 0) + 1;
    let priceText = priceEl?.textContent || '0';
    // Also try meta tag as last resort
    if (priceText === '0') {
      const metaPrice = document.querySelector('meta[property="product:price:amount"]') as HTMLMetaElement;
      if (metaPrice?.content) priceText = metaPrice.content;
    }
    const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

    // Sales
    const salesEl = queryWithStrategy(SELECTOR_STRATEGIES.sales);
    if (!salesEl) selectorFailures['sales'] = (selectorFailures['sales'] || 0) + 1;
    const salesText = salesEl?.textContent || '0';
    // Handle "1.2k", "1,200", "1200+" formats
    let salesCount = 0;
    const kMatch = salesText.match(/([\d,.]+)\s*[kK]/);
    if (kMatch) {
      salesCount = Math.round(parseFloat(kMatch[1].replace(/,/g, '')) * 1000);
    } else {
      salesCount = parseInt(salesText.replace(/[^0-9]/g, '')) || 0;
    }

    // Shop Name
    const shopEl = queryWithStrategy(SELECTOR_STRATEGIES.shopName);
    if (!shopEl) selectorFailures['shopName'] = (selectorFailures['shopName'] || 0) + 1;
    const shopName = shopEl?.textContent?.trim() || 'Unknown Shop';

    // Image
    const imageEl = queryWithStrategy(SELECTOR_STRATEGIES.image);
    if (!imageEl) selectorFailures['image'] = (selectorFailures['image'] || 0) + 1;
    let imageUrl = '';
    if (imageEl instanceof HTMLImageElement) {
      imageUrl = imageEl.src;
    } else {
      const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
      imageUrl = ogImage?.content || '';
    }

    return {
      id: window.location.pathname.split('/').pop() || Date.now().toString(),
      title,
      price,
      salesCount,
      shopName,
      imageUrl,
      shopUrl: window.location.href,
      lastChecked: Date.now()
    };
  } catch (e) {
    console.error('[ShopPilot] Error scraping product info:', e);
    return null;
  }
}

function injectTrackButton() {
  setTimeout(() => {
    if (document.getElementById('shoppilot-track-host')) return;

    const host = document.createElement('div');
    host.id = 'shoppilot-track-host';
    host.style.cssText = 'position: fixed; z-index: 99998; top: 0; right: 0; pointer-events: none;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });

    shadow.innerHTML = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :host { all: initial; }
        
        .sp-track-btn {
          position: fixed;
          top: 100px;
          right: 20px;
          background: #FFFFFF;
          color: #161823;
          border: 1px solid #E3E3E4;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transition: all 0.2s;
          pointer-events: auto;
          font-family: Inter, system-ui, -apple-system, sans-serif;
        }
        
        .sp-track-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.12);
          border-color: #FE2C55;
        }
        
        .sp-track-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .sp-track-btn.success {
          background: #F0FFF4;
          color: #2F855A;
        }
      </style>
      <button class="sp-track-btn" id="sp-track-btn">
        <span>📊</span> Track this product
      </button>
    `;

    const btn = shadow.getElementById('sp-track-btn') as HTMLButtonElement;

    btn?.addEventListener('click', async () => {
      const productInfo = scrapeProductInfo();
      if (productInfo) {
        btn.disabled = true;
        btn.innerHTML = `<span>⏳</span> Tracking...`;

        const response = await chrome.runtime.sendMessage({
          type: 'TRACK_PRODUCT',
          payload: {
            url: window.location.href,
            productInfo
          }
        });

        if (response.success) {
          btn.innerHTML = `<span>✅</span> Tracked!`;
          btn.classList.add('success');
          showStatus('Product added to monitoring list!');
        } else {
          btn.innerHTML = `<span>❌</span> Failed`;
          btn.disabled = false;
          showStatus(response.error || 'Failed to track product');
        }
      }
    });
  }, 2000);
}

// Observe URL changes (SPA)
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    onPageChange();
  }
});

// ---- Message Handler (from popup/sidepanel) ----

async function fillInviteMessage(text: string) {
  const selectors = [
    '[contenteditable="true"]',
    '.ql-editor',
    'textarea[data-testid="message-input"]',
    'textarea',
    '[role="textbox"]'
  ];

  let input: HTMLElement | null = null;
  for (const selector of selectors) {
    input = document.querySelector(selector);
    if (input) break;
  }

  if (!input) {
    console.error('[ShopPilot] Could not find message input field');
    return false;
  }

  try {
    input.focus();

    if (input.isContentEditable) {
      input.innerHTML = '';
      const textNode = document.createTextNode(text);
      input.appendChild(textNode);
    } else if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      input.value = text;
    }

    const inputEvent = new Event('input', { bubbles: true });
    input.dispatchEvent(inputEvent);
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);

    return true;
  } catch (e) {
    console.error('[ShopPilot] Error filling input:', e);
    return false;
  }
}

/**
 * Execute a creator invite action on the current TikTok Seller Center page.
 * This attempts to find the creator's invite/message button and fill in the message.
 */
async function executeCreatorInvite(payload: {
  creatorId: string;
  creatorUsername: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Strategy 1: Look for invite/message button near creator's card
    const creatorCards = document.querySelectorAll('[class*="creator"], [class*="Creator"], [data-creator-id]');
    
    for (const card of Array.from(creatorCards)) {
      const cardText = card.textContent || '';
      if (cardText.includes(payload.creatorUsername) || 
          card.getAttribute('data-creator-id') === payload.creatorId) {
        // Found the creator card — look for invite button
        const inviteBtn = card.querySelector(
          'button[class*="invite"], button[class*="Invite"], ' +
          'button[class*="message"], button[class*="Message"], ' +
          'button[class*="contact"], button[class*="Contact"], ' +
          '[data-testid*="invite"], [data-testid*="message"]'
        ) as HTMLElement | null;

        if (inviteBtn) {
          inviteBtn.click();
          // Wait for modal/input to appear
          await new Promise(r => setTimeout(r, 1500));
          
          // Fill the message
          const filled = await fillInviteMessage(payload.message);
          if (filled) {
            showStatus(`Invite sent to @${payload.creatorUsername}`, 3000);
            return { success: true };
          } else {
            return { success: false, error: 'Could not fill message input after clicking invite button' };
          }
        }
      }
    }

    // Strategy 2: If we're already on a messaging page, just fill the message
    if (window.location.pathname.includes('/im') || window.location.pathname.includes('/message')) {
      const filled = await fillInviteMessage(payload.message);
      if (filled) {
        showStatus(`Message filled for @${payload.creatorUsername}`, 3000);
        return { success: true };
      }
    }

    return { success: false, error: `Could not find invite button for @${payload.creatorUsername}` };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GET_CREATORS':
      sendResponse({ creators: capturedCreators });
      break;
    case 'AUTOFILL_INVITE': {
      fillInviteMessage(message.payload.message).then(success => {
        if (success) {
          showStatus('Message filled! Review and click Send.', 5000);
          sendResponse({ success: true });
        } else {
          showStatus('Failed to find input field. Please focus it manually.', 5000);
          sendResponse({ error: 'Input field not found' });
        }
      });
      return true;
    }
    case 'EXECUTE_INVITE': {
      executeCreatorInvite(message.payload).then(result => {
        sendResponse(result);
      });
      return true;
    }
    case 'SCRAPE_PRODUCT_DATA': {
      const data = scrapeProductInfo();
      if (data) {
        sendResponse(data);
      } else {
        sendResponse({ error: 'Failed to scrape data' });
      }
      return true;
    }
    default:
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
  return true;
});

// ---- Initialize ----

function init() {
  console.log('[ShopPilot] Content script (ISOLATED world bridge) loaded on:', window.location.href);
  injectToolbar();
  onPageChange();
  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Verify MAIN world interceptor is running
  window.postMessage({ source: SP_SOURCE_BRIDGE, type: 'PING' }, '*');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
