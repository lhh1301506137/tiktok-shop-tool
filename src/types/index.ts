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
export type AIProvider = 'openai' | 'minimax' | 'deepseek' | 'custom';

/** AI provider configuration */
export const AI_PROVIDERS: Record<AIProvider, {
  name: string;
  apiUrl: string;
  defaultModel: string;
  models: string[];
  keyPrefix: string;  // expected key prefix for validation hint
}> = {
  openai: {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'],
    keyPrefix: 'sk-',
  },
  minimax: {
    name: 'MiniMax',
    apiUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    defaultModel: 'MiniMax-M2.7',
    models: ['MiniMax-M2.7', 'MiniMax-M2.5'],
    keyPrefix: '',
  },
  deepseek: {
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyPrefix: 'sk-',
  },
  custom: {
    name: 'Custom (OpenAI-compatible)',
    apiUrl: '',
    defaultModel: '',
    models: [],
    keyPrefix: '',
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

/** Trial mode constants */
export const TRIAL_AI_LIMIT = 5;  // Free AI calls without API key

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
