/**
 * ShopPilot - Injected Script (MAIN world)
 * Runs in the page's main execution context to intercept real network requests.
 * Communicates with the bridge script via window.postMessage.
 */

const SP_SOURCE = 'shoppilot-injected';

// ---- Network Interceptor ----

const originalFetch = window.fetch;

window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);

  try {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;

    if (url.includes('/affiliate/creator') || url.includes('creator/search')) {
      const clone = response.clone();
      const data = await clone.json();
      window.postMessage({
        source: SP_SOURCE,
        type: 'CREATORS_RAW_DATA',
        payload: data,
      }, window.location.origin);
    }
  } catch (e) {
    // Silently fail - don't break the page
  }

  return response;
};

// Also hook XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
  this.addEventListener('load', function () {
    try {
      const urlStr = url.toString();
      if (urlStr.includes('/affiliate/creator') || urlStr.includes('creator/search')) {
        const data = JSON.parse(this.responseText);
        window.postMessage({
          source: SP_SOURCE,
          type: 'CREATORS_RAW_DATA',
          payload: data,
        }, window.location.origin);
      }
    } catch (e) {
      // Silently fail
    }
  });
  return originalXHROpen.apply(this, [method, url, ...rest] as any);
};

// Listen for commands from the bridge (ISOLATED world)
window.addEventListener('message', (event) => {
  if (event.source !== window || event.data?.source !== 'shoppilot-bridge') return;

  if (event.data.type === 'PING') {
    window.postMessage({ source: SP_SOURCE, type: 'PONG' }, window.location.origin);
  }
});

console.log('[ShopPilot] Network interceptor injected into MAIN world');
