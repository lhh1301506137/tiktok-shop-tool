# Chrome Web Store Review Notes

## Permission Justification

### Host Permissions

| Permission | Reason |
|:---|:---|
| `https://seller-*.tiktok.com/*` | Content scripts run on TikTok Seller Center to extract creator data from page DOM and intercept API responses for the creator marketplace feature. Required for core functionality. |
| `https://affiliate.tiktokshop.com/*` | Content scripts run on TikTok Affiliate platform for creator outreach features. |
| `https://www.tiktok.com/view/product/*` | Content scripts run on TikTok product pages to scrape product info for competitor monitoring. Limited to product view pages only. |
| `https://api.minimax.chat/*` | AI text generation API. Users provide their own API keys (BYOK model). No data is sent without explicit user action. |
| `https://api.openai.com/*` | Alternative AI provider. Same BYOK model — users configure their own keys. |
| `https://api.deepseek.com/*` | Alternative AI provider. Same BYOK model. |

### API Permissions

| Permission | Reason |
|:---|:---|
| `storage` | Store user settings (API keys, preferences), cached creator data, tracked products, and AI generation history. All data stays local. |
| `sidePanel` | The extension's main UI is a side panel that shows creator lists, invite tools, listing generator, and competitor monitor alongside TikTok Seller Center. |
| `tabs` | Required to: (1) Open side panel on the correct tab, (2) Create hidden tabs for background product data refresh, (3) Send messages to content scripts in specific tabs. |
| `alarms` | Schedule periodic competitor price/sales checks (every 6 hours by default). |
| `notifications` | Alert users about significant price drops (>5%) or sales spikes (>20%) in tracked competitor products. |
| `activeTab` | Access the current tab's URL to determine which TikTok Seller Center page the user is on. |

### Content Scripts

Two content scripts are injected:

1. **ISOLATED world script** (`content/index.js`): Bridges extension messaging with the page. Injects UI elements (floating action button, product tracking button) via Shadow DOM to prevent style conflicts. Handles DOM scraping for product data.

2. **MAIN world script** (`content/injected.js`): Intercepts `fetch` and `XMLHttpRequest` calls to capture creator data from TikTok's API responses as they load on the page. This is necessary because the data is only available in the page's execution context, not the extension's isolated world.

### Remote Code

This extension does **not** use any remote code. All JavaScript is bundled at build time. The only remote calls are:
- AI API requests (OpenAI, MiniMax, DeepSeek) — initiated only by explicit user action
- No analytics, tracking, or telemetry

### Data Handling

- **BYOK (Bring Your Own Key)**: Users provide their own AI API keys. We do not provide or manage API keys.
- **Local Storage Only**: All data (creators, products, settings, history) is stored in `chrome.storage.local`. Nothing is sent to our servers.
- **No User Accounts**: No sign-up, no login, no server-side storage.
- **No Data Collection**: We do not collect, transmit, or store any user data externally.

## Single Purpose Description

ShopPilot helps TikTok Shop sellers manage their store more efficiently by providing:
1. Creator discovery and outreach automation on TikTok Seller Center
2. AI-powered invitation message and product listing generation
3. Competitor product price and sales monitoring

All features are directly related to TikTok Shop seller operations.
