// ============================================================
// Core Types for ShopPilot - TikTok Shop Seller Tool
// ============================================================

/** TikTok Shop Creator/Influencer */
export interface Creator {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  videoCount: number;
  // Affiliate performance
  gmv30d: number;        // GMV in last 30 days (USD)
  itemsSold30d: number;  // Items sold in last 30 days
  avgCommission: number; // Average commission rate (0-100)
  categories: string[];  // Product categories they promote
  // Contact
  email?: string;
  contactInfo?: string;
  // Status
  inviteStatus: InviteStatus;
  invitedAt?: number;    // Unix timestamp
  lastUpdated: number;
}

export type InviteStatus = 'none' | 'pending' | 'accepted' | 'declined' | 'expired';

/** AI-generated invitation message */
export interface InviteMessage {
  id: string;
  creatorId: string;
  subject: string;
  body: string;
  tone: 'professional' | 'casual' | 'friendly';
  generatedAt: number;
  sent: boolean;
}

/** Saved invite template for reuse */
export interface InviteTemplate {
  id: string;
  name: string;
  body: string;
  tone: InviteMessage['tone'];
  createdAt: number;
  useCount: number;  // track how popular each template is
}

/** Competitor product being tracked */
export interface TrackedProduct {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  shopName: string;
  shopUrl: string;
  salesCount: number;
  rating: number;
  // Tracking
  priceHistory: PricePoint[];
  addedAt: number;
  lastChecked: number;
}

export interface PricePoint {
  price: number;
  timestamp: number;
}

/** AI-generated product listing copy */
export interface ListingCopy {
  id: string;
  productTitle: string;
  title: string;
  description: string;
  bulletPoints: string[];
  seoTags: string[];
  language: string;
  generatedAt: number;
}

/** AI generation history entry */
export interface AIHistoryEntry {
  id: string;
  type: 'invite' | 'listing';
  input: string;           // What was asked (creator name or product description)
  output: string;          // Full generated text
  metadata?: Record<string, any>;  // Tone, model used, etc.
  createdAt: number;
}

/** Supported AI providers */
export type AIProvider =
  | 'openai'
  | 'claude'
  | 'gemini'
  | 'deepseek'
  | 'glm'
  | 'kimi'
  | 'minimax'
  | 'custom';

/** AI provider configuration */
export const AI_PROVIDERS: Record<AIProvider, {
  name: string;
  apiUrl: string;
  defaultModel: string;
  models: string[];
  keyPrefix: string;  // expected key prefix for validation hint
  keyUrl: string;     // URL to get API key
  authStyle: 'bearer' | 'x-api-key';  // authentication header style
}> = {
  openai: {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'],
    keyPrefix: 'sk-',
    keyUrl: 'https://platform.openai.com/api-keys',
    authStyle: 'bearer',
  },
  claude: {
    name: 'Claude (Anthropic)',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    keyPrefix: 'sk-ant-',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    authStyle: 'x-api-key',
  },
  gemini: {
    name: 'Gemini (Google)',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    keyPrefix: '',
    keyUrl: 'https://aistudio.google.com/apikey',
    authStyle: 'bearer',
  },
  deepseek: {
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyPrefix: 'sk-',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    authStyle: 'bearer',
  },
  glm: {
    name: 'GLM (智谱)',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-flash',
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4-long'],
    keyPrefix: '',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    authStyle: 'bearer',
  },
  kimi: {
    name: 'Kimi (月之暗面)',
    apiUrl: 'https://api.moonshot.cn/v1/chat/completions',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    keyPrefix: 'sk-',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    authStyle: 'bearer',
  },
  minimax: {
    name: 'MiniMax',
    apiUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    defaultModel: 'MiniMax-M2.7',
    models: ['MiniMax-M2.7', 'MiniMax-M2.5'],
    keyPrefix: '',
    keyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
    authStyle: 'bearer',
  },
  custom: {
    name: 'Custom (OpenAI-compatible)',
    apiUrl: '',
    defaultModel: '',
    models: [],
    keyPrefix: '',
    keyUrl: '',
    authStyle: 'bearer',
  },
};

/** User subscription tier */
export type SubscriptionTier = 'free' | 'pro' | 'business';

/** User settings stored in chrome.storage */
export interface UserSettings {
  // Auth
  apiKey?: string;  // AI API Key (BYOK mode)
  aiProvider: AIProvider;
  aiModel?: string;     // override default model
  customApiUrl?: string; // for 'custom' provider
  userId?: string;
  tier: SubscriptionTier;
  // Usage limits
  dailyInvites: number;
  dailyAiGenerations: number;
  // Preferences
  defaultCommission: number;  // Default commission rate for invitations
  defaultTone: InviteMessage['tone'];
  language: 'en' | 'zh';
  theme: 'light' | 'dark' | 'system';
  // Product info (injected into AI invites)
  productName?: string;
  productDescription?: string;
  commissionRate?: number;
  // Integration
  formspreeId?: string;   // Formspree form ID for online feedback submission
  // Tracking
  lastSyncAt?: number;
}

/** Message types for chrome.runtime messaging */
export type MessageType =
  | { type: 'GET_CREATORS'; payload?: { page?: number } }
  | { type: 'CREATORS_DATA'; payload: Creator[] }
  | { type: 'GENERATE_INVITE'; payload: { creator: Creator; tone: string } }
  | { type: 'INVITE_GENERATED'; payload: InviteMessage }
  | { type: 'SEND_INVITE'; payload: { creatorId: string; message: string } }
  | { type: 'INVITE_SENT'; payload: { success: boolean; creatorId: string } }
  | { type: 'TRACK_PRODUCT'; payload: { url: string; productInfo?: Partial<TrackedProduct> } }
  | { type: 'REFRESH_TRACKED_PRODUCTS' }
  | { type: 'GENERATE_LISTING'; payload: { productInfo: string } }
  | { type: 'OPEN_SIDEPANEL' }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'AUTOFILL_INVITE'; payload: { creatorId: string; message: string } }
  | { type: 'GET_AI_HISTORY'; payload?: { type?: 'invite' | 'listing' } }
  | { type: 'DELETE_AI_HISTORY'; payload: { id: string } }
  | { type: 'BATCH_INVITE'; payload: { creators: Creator[]; tone: string } }
  | { type: 'STOP_BATCH_INVITE' }
  | { type: 'GET_INVITE_QUEUE' }
  | { type: 'EXECUTE_INVITE'; payload: { creatorId: string; creatorUsername: string; message: string } }
  | { type: 'CHECK_LIMITS' };

/** Usage stats for the current period */
export interface UsageStats {
  invitesSentToday: number;
  aiGenerationsToday: number;
  creatorsScraped: number;
  productsTracked: number;
  trialAiUsed: number;      // Lifetime trial AI calls used (never resets)
  lastResetDate: string;  // YYYY-MM-DD
}

/** Daily usage snapshot for historical stats */
export interface DailySnapshot {
  date: string;  // YYYY-MM-DD
  invitesSent: number;
  aiGenerations: number;
  creatorsTotal: number;     // cumulative count at end of day
  productsTracked: number;   // cumulative count at end of day
}

/** LemonSqueezy license info */
export interface LicenseInfo {
  key: string;
  instanceId: string;         // returned by LS on activation
  status: 'active' | 'inactive' | 'expired' | 'disabled';
  tier: SubscriptionTier;     // derived from LS variant/product
  customerName?: string;
  customerEmail?: string;
  validatedAt: number;        // last successful validation timestamp
  expiresAt?: number;         // subscription expiry (Unix ms), undefined = lifetime
  variantName?: string;       // "Pro" or "Business"
}

// LemonSqueezy configuration — replace with real values when LS account is set up
export const LS_CONFIG = {
  // Checkout URLs (replace with your real LemonSqueezy checkout links)
  proCheckoutUrl: 'https://shoppilot.lemonsqueezy.com/checkout/buy/pro',
  businessCheckoutUrl: 'https://shoppilot.lemonsqueezy.com/checkout/buy/business',
  // Product variant IDs (replace when products are created in LS dashboard)
  proVariantId: '',       // TODO: fill after creating LS products
  businessVariantId: '',  // TODO: fill after creating LS products
};

/** Trial mode constants */
export const TRIAL_AI_LIMIT = 5;  // Free AI calls without API key

// ---- Referral System ----

/** Referral info stored locally */
export interface ReferralInfo {
  /** This user's own referral code (generated from install ID) */
  myCode: string;
  /** Number of people who entered this user's code */
  referralCount: number;
  /** Bonus AI credits earned from referrals */
  bonusAiCredits: number;
  /** Whether this user has already applied someone else's code */
  appliedCode?: string;
  /** Bonus AI credits received as a referee */
  refereeBonus: number;
  /** Timestamps of successful referrals */
  referralHistory: number[];
}

/** Referral reward constants */
export const REFERRAL_REWARDS = {
  /** Bonus AI credits the referrer gets per successful referral */
  CREDITS_PER_REFERRAL: 5,
  /** Max total bonus credits from referrals */
  MAX_REFERRAL_BONUS: 50,
  /** Bonus AI credits the new user gets when entering a referral code */
  REFEREE_BONUS: 3,
  /** Share link base (code appended as ?ref=CODE) */
  SHARE_URL_BASE: 'https://shoppilot.pro',
} as const;

/** Limits per subscription tier */
export const TIER_LIMITS: Record<SubscriptionTier, {
  dailyInvites: number;
  dailyAiGenerations: number;
  maxTrackedProducts: number;
  maxSavedCreators: number;
}> = {
  free: {
    dailyInvites: 5,
    dailyAiGenerations: 10,
    maxTrackedProducts: 3,
    maxSavedCreators: 200,
  },
  pro: {
    dailyInvites: 100,
    dailyAiGenerations: 200,
    maxTrackedProducts: 50,
    maxSavedCreators: 2000,
  },
  business: {
    dailyInvites: -1,  // unlimited
    dailyAiGenerations: -1,
    maxTrackedProducts: -1,
    maxSavedCreators: -1,
  },
};
