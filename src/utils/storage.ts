import { UserSettings, UsageStats, Creator, TrackedProduct, SubscriptionTier, AIHistoryEntry, InviteTemplate, DailySnapshot, LicenseInfo, ReferralInfo, TIER_LIMITS, TRIAL_AI_LIMIT, REFERRAL_REWARDS } from '@/types';

const DEFAULT_SETTINGS: UserSettings = {
  tier: 'free' as SubscriptionTier,
  aiProvider: 'deepseek',
  dailyInvites: 5,
  dailyAiGenerations: 10,
  defaultCommission: 15,
  defaultTone: 'professional',
  language: 'en',
  theme: 'light',
};

const DEFAULT_USAGE: UsageStats = {
  invitesSentToday: 0,
  aiGenerationsToday: 0,
  creatorsScraped: 0,
  productsTracked: 0,
  trialAiUsed: 0,
  lastResetDate: new Date().toISOString().split('T')[0],
};

/** URL for upgrade / pricing page */
export const UPGRADE_URL = 'https://shoppilot.pro/#pricing';

// ---- Settings ----

export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

export async function updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ settings: updated });
  return updated;
}

// ---- Usage Stats ----

export async function getUsage(): Promise<UsageStats> {
  const result = await chrome.storage.local.get('usage');
  const usage = { ...DEFAULT_USAGE, ...result.usage };

  // Auto-reset daily counters
  const today = new Date().toISOString().split('T')[0];
  if (usage.lastResetDate !== today) {
    // Save yesterday's snapshot before resetting
    if (usage.invitesSentToday > 0 || usage.aiGenerationsToday > 0) {
      await saveDailySnapshot({
        date: usage.lastResetDate,
        invitesSent: usage.invitesSentToday,
        aiGenerations: usage.aiGenerationsToday,
        creatorsTotal: usage.creatorsScraped,
        productsTracked: usage.productsTracked,
      });
    }
    usage.invitesSentToday = 0;
    usage.aiGenerationsToday = 0;
    usage.lastResetDate = today;
    await chrome.storage.local.set({ usage });
  }

  return usage;
}

/** Serialize incrementUsage calls to prevent lost updates */
let _usageLock: Promise<UsageStats> = Promise.resolve({} as UsageStats);

export function incrementUsage(
  field: 'invitesSentToday' | 'aiGenerationsToday' | 'creatorsScraped' | 'productsTracked'
): Promise<UsageStats> {
  _usageLock = _usageLock
    .catch(() => {})
    .then(async () => {
      const usage = await getUsage();
      usage[field] += 1;
      await chrome.storage.local.set({ usage });
      return usage;
    });
  return _usageLock;
}

// ============================================================
// Creators — Chunked Storage
// ============================================================
// Instead of one massive 'creators' array, data is stored in chunks:
//   'creators_meta' → { totalCount, chunkCount, lastUpdated }
//   'creators_0'    → Creator[] (up to CHUNK_SIZE items)
//   'creators_1'    → Creator[] ...
// This reduces write amplification from O(n) to O(CHUNK_SIZE).
// ============================================================

const CHUNK_SIZE = 200;

interface CreatorsMeta {
  totalCount: number;
  chunkCount: number;
  lastUpdated: number;
}

/** Promise-based lock to prevent concurrent migration */
let migrationPromise: Promise<void> | null = null;

/** Migrate legacy single-key storage to chunked format (one-time, concurrency-safe) */
async function migrateCreatorsIfNeeded(): Promise<void> {
  // If migration is already in progress, await the same promise
  if (migrationPromise) return migrationPromise;
  migrationPromise = doMigrate();
  try {
    await migrationPromise;
  } finally {
    migrationPromise = null;
  }
}

async function doMigrate(): Promise<void> {
  const result = await chrome.storage.local.get(['creators', 'creators_meta']);

  // Already migrated or fresh install
  if (result.creators_meta) return;

  // No legacy data either
  if (!result.creators || !Array.isArray(result.creators) || result.creators.length === 0) {
    // Initialize empty meta
    await chrome.storage.local.set({
      creators_meta: { totalCount: 0, chunkCount: 0, lastUpdated: Date.now() } as CreatorsMeta,
    });
    return;
  }

  // Migrate legacy array → chunks
  const allCreators: Creator[] = result.creators;
  const chunkCount = Math.ceil(allCreators.length / CHUNK_SIZE);
  const writes: Record<string, any> = {
    creators_meta: {
      totalCount: allCreators.length,
      chunkCount,
      lastUpdated: Date.now(),
    } as CreatorsMeta,
  };

  for (let i = 0; i < chunkCount; i++) {
    writes[`creators_${i}`] = allCreators.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  }

  await chrome.storage.local.set(writes);

  // Remove legacy key
  await chrome.storage.local.remove('creators');
}

/** Get all saved creators (reads all chunks) */
export async function getSavedCreators(): Promise<Creator[]> {
  await migrateCreatorsIfNeeded();

  const metaResult = await chrome.storage.local.get('creators_meta');
  const meta: CreatorsMeta | undefined = metaResult.creators_meta;
  if (!meta || meta.chunkCount === 0) return [];

  // Read all chunks in parallel
  const chunkKeys = Array.from({ length: meta.chunkCount }, (_, i) => `creators_${i}`);
  const chunksResult = await chrome.storage.local.get(chunkKeys);

  const allCreators: Creator[] = [];
  for (const key of chunkKeys) {
    const chunk = chunksResult[key];
    if (Array.isArray(chunk)) {
      allCreators.push(...chunk);
    }
  }

  return allCreators;
}

/** Save new creators (merge with existing, write only affected chunks) */
export async function saveCreators(newCreators: Creator[]): Promise<void> {
  await migrateCreatorsIfNeeded();

  const allExisting = await getSavedCreators();
  const existingMap = new Map(allExisting.map(c => [c.id, c]));

  for (const creator of newCreators) {
    existingMap.set(creator.id, { ...existingMap.get(creator.id), ...creator });
  }

  const merged = Array.from(existingMap.values());
  await writeAllCreatorChunks(merged);
}

/** Update a single creator by ID (only writes the affected chunk) */
export async function updateCreator(id: string, partial: Partial<Creator>): Promise<void> {
  await migrateCreatorsIfNeeded();

  const metaResult = await chrome.storage.local.get('creators_meta');
  const meta: CreatorsMeta | undefined = metaResult.creators_meta;
  if (!meta || meta.chunkCount === 0) return;

  // Search through chunks to find the one containing this creator
  for (let i = 0; i < meta.chunkCount; i++) {
    const key = `creators_${i}`;
    const result = await chrome.storage.local.get(key);
    const chunk: Creator[] = result[key] || [];
    const index = chunk.findIndex(c => c.id === id);

    if (index >= 0) {
      chunk[index] = { ...chunk[index], ...partial };
      await chrome.storage.local.set({ [key]: chunk });
      return;
    }
  }
}

/** Overwrite all creator chunks from a full array */
async function writeAllCreatorChunks(creators: Creator[]): Promise<void> {
  // Read old meta first to know how many stale chunks to clean up
  const metaResult = await chrome.storage.local.get('creators_meta');
  const oldMeta: CreatorsMeta | undefined = metaResult.creators_meta;
  const oldChunkCount = oldMeta?.chunkCount ?? 0;

  const newChunkCount = creators.length === 0 ? 0 : Math.ceil(creators.length / CHUNK_SIZE);
  const writes: Record<string, any> = {
    creators_meta: {
      totalCount: creators.length,
      chunkCount: newChunkCount,
      lastUpdated: Date.now(),
    } as CreatorsMeta,
  };

  for (let i = 0; i < newChunkCount; i++) {
    writes[`creators_${i}`] = creators.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  }

  await chrome.storage.local.set(writes);

  // Clean up stale chunks from a previous larger dataset
  if (oldChunkCount > newChunkCount) {
    const staleKeys = Array.from(
      { length: oldChunkCount - newChunkCount },
      (_, i) => `creators_${newChunkCount + i}`
    );
    if (staleKeys.length > 0) {
      await chrome.storage.local.remove(staleKeys);
    }
  }
}

// ---- Tracked Products ----

export async function getTrackedProducts(): Promise<TrackedProduct[]> {
  const result = await chrome.storage.local.get('trackedProducts');
  return result.trackedProducts || [];
}

export async function addTrackedProduct(product: TrackedProduct): Promise<void> {
  const products = await getTrackedProducts();
  products.push(product);
  await chrome.storage.local.set({ trackedProducts: products });
}

export async function removeTrackedProduct(id: string): Promise<void> {
  const products = await getTrackedProducts();
  await chrome.storage.local.set({
    trackedProducts: products.filter(p => p.id !== id),
  });
}

export async function updateTrackedProduct(id: string, partial: Partial<TrackedProduct>): Promise<void> {
  const products = await getTrackedProducts();
  const index = products.findIndex(p => p.id === id);
  if (index >= 0) {
    const updated = { ...products[index], ...partial };
    // If price changed, add to history
    if (partial.price !== undefined && partial.price !== products[index].price) {
      updated.priceHistory = [
        ...(updated.priceHistory || []),
        { price: partial.price, timestamp: Date.now() }
      ].slice(-20); // Keep last 20 points
    }
    products[index] = updated;
    await chrome.storage.local.set({ trackedProducts: products });
  }
}

/** Get price history for trend display */
export async function getProductPriceHistory(id: string): Promise<{ price: number; timestamp: number }[]> {
  const products = await getTrackedProducts();
  const product = products.find(p => p.id === id);
  return product?.priceHistory || [];
}

// ---- AI History ----

const MAX_HISTORY_ENTRIES = 100;

export async function getAIHistory(filterType?: 'invite' | 'listing'): Promise<AIHistoryEntry[]> {
  const result = await chrome.storage.local.get('aiHistory');
  const history: AIHistoryEntry[] = result.aiHistory || [];
  if (filterType) {
    return history.filter(h => h.type === filterType);
  }
  return history;
}

export async function addAIHistory(entry: Omit<AIHistoryEntry, 'id' | 'createdAt'>): Promise<AIHistoryEntry> {
  const history = await getAIHistory();
  const newEntry: AIHistoryEntry = {
    ...entry,
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  history.unshift(newEntry);
  // Keep only the latest entries
  const trimmed = history.slice(0, MAX_HISTORY_ENTRIES);
  await chrome.storage.local.set({ aiHistory: trimmed });
  return newEntry;
}

export async function deleteAIHistory(id: string): Promise<void> {
  const history = await getAIHistory();
  await chrome.storage.local.set({
    aiHistory: history.filter(h => h.id !== id),
  });
}

// ---- Tier Limit Checks ----

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  tier: SubscriptionTier;
  limitType: string;
}

export async function checkDailyInviteLimit(): Promise<LimitCheckResult> {
  const settings = await getSettings();
  const usage = await getUsage();
  const limits = TIER_LIMITS[settings.tier];
  return {
    allowed: limits.dailyInvites === -1 || usage.invitesSentToday < limits.dailyInvites,
    current: usage.invitesSentToday,
    limit: limits.dailyInvites,
    tier: settings.tier,
    limitType: 'dailyInvites',
  };
}

export async function checkDailyAILimit(): Promise<LimitCheckResult> {
  const settings = await getSettings();
  const usage = await getUsage();
  const limits = TIER_LIMITS[settings.tier];
  // Referral bonus adds to the daily limit for free tier
  const referralBonus = settings.tier === 'free' ? await getTotalReferralBonus() : 0;
  const effectiveLimit = limits.dailyAiGenerations === -1 ? -1 : limits.dailyAiGenerations + referralBonus;
  return {
    allowed: effectiveLimit === -1 || usage.aiGenerationsToday < effectiveLimit,
    current: usage.aiGenerationsToday,
    limit: effectiveLimit,
    tier: settings.tier,
    limitType: 'dailyAiGenerations',
  };
}

export async function checkTrackedProductLimit(): Promise<LimitCheckResult> {
  const settings = await getSettings();
  const products = await getTrackedProducts();
  const limits = TIER_LIMITS[settings.tier];
  return {
    allowed: limits.maxTrackedProducts === -1 || products.length < limits.maxTrackedProducts,
    current: products.length,
    limit: limits.maxTrackedProducts,
    tier: settings.tier,
    limitType: 'maxTrackedProducts',
  };
}

export async function checkSavedCreatorLimit(): Promise<LimitCheckResult> {
  const settings = await getSettings();
  const creators = await getSavedCreators();
  const limits = TIER_LIMITS[settings.tier];
  return {
    allowed: limits.maxSavedCreators === -1 || creators.length < limits.maxSavedCreators,
    current: creators.length,
    limit: limits.maxSavedCreators,
    tier: settings.tier,
    limitType: 'maxSavedCreators',
  };
}

// ---- Trial Mode ----

export interface TrialStatus {
  available: boolean;  // true if user has no API key AND trial credits left
  used: number;
  limit: number;
  hasApiKey: boolean;
}

export async function getTrialStatus(): Promise<TrialStatus> {
  const settings = await getSettings();
  const usage = await getUsage();
  const hasApiKey = !!settings.apiKey;
  // Referral bonus extends the trial limit
  const referralBonus = await getTotalReferralBonus();
  const effectiveLimit = TRIAL_AI_LIMIT + referralBonus;
  return {
    available: !hasApiKey && usage.trialAiUsed < effectiveLimit,
    used: usage.trialAiUsed,
    limit: effectiveLimit,
    hasApiKey,
  };
}

export async function incrementTrialUsage(): Promise<void> {
  const usage = await getUsage();
  usage.trialAiUsed += 1;
  await chrome.storage.local.set({ usage });
}

// ---- Invite Templates ----

const MAX_TEMPLATES = 20;

export async function getInviteTemplates(): Promise<InviteTemplate[]> {
  const result = await chrome.storage.local.get('inviteTemplates');
  return result.inviteTemplates || [];
}

export async function saveInviteTemplate(template: Omit<InviteTemplate, 'id' | 'createdAt' | 'useCount'>): Promise<InviteTemplate> {
  const templates = await getInviteTemplates();
  const newTemplate: InviteTemplate = {
    ...template,
    id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: Date.now(),
    useCount: 0,
  };
  // Prepend (newest first); cap at MAX_TEMPLATES
  templates.unshift(newTemplate);
  if (templates.length > MAX_TEMPLATES) templates.length = MAX_TEMPLATES;
  await chrome.storage.local.set({ inviteTemplates: templates });
  return newTemplate;
}

export async function deleteInviteTemplate(id: string): Promise<void> {
  const templates = await getInviteTemplates();
  await chrome.storage.local.set({ inviteTemplates: templates.filter(t => t.id !== id) });
}

export async function incrementTemplateUseCount(id: string): Promise<void> {
  const templates = await getInviteTemplates();
  const tpl = templates.find(t => t.id === id);
  if (tpl) {
    tpl.useCount += 1;
    await chrome.storage.local.set({ inviteTemplates: templates });
  }
}

// ---- Daily Snapshots (Historical Stats) ----

const MAX_SNAPSHOTS = 30;  // Keep 30 days of history

async function saveDailySnapshot(snapshot: DailySnapshot): Promise<void> {
  const result = await chrome.storage.local.get('dailySnapshots');
  const snapshots: DailySnapshot[] = result.dailySnapshots || [];
  // Avoid duplicates (same date)
  const existing = snapshots.findIndex(s => s.date === snapshot.date);
  if (existing >= 0) {
    snapshots[existing] = snapshot;
  } else {
    snapshots.push(snapshot);
  }
  // Keep only recent entries
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.sort((a, b) => a.date.localeCompare(b.date));
    snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
  }
  await chrome.storage.local.set({ dailySnapshots: snapshots });
}

export async function getDailySnapshots(days: number = 7): Promise<DailySnapshot[]> {
  const result = await chrome.storage.local.get('dailySnapshots');
  const snapshots: DailySnapshot[] = result.dailySnapshots || [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return snapshots
    .filter(s => s.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface WeeklyStats {
  totalInvites: number;
  totalAiGenerations: number;
  dailyData: DailySnapshot[];
  avgInvitesPerDay: number;
  avgAiPerDay: number;
}

export async function getWeeklyStats(): Promise<WeeklyStats> {
  const snapshots = await getDailySnapshots(7);
  // Also include today's ongoing data
  const usage = await getUsage();
  const today: DailySnapshot = {
    date: new Date().toISOString().split('T')[0],
    invitesSent: usage.invitesSentToday,
    aiGenerations: usage.aiGenerationsToday,
    creatorsTotal: usage.creatorsScraped,
    productsTracked: usage.productsTracked,
  };
  const allData = [...snapshots.filter(s => s.date !== today.date), today];

  const totalInvites = allData.reduce((sum, d) => sum + d.invitesSent, 0);
  const totalAiGenerations = allData.reduce((sum, d) => sum + d.aiGenerations, 0);
  const activeDays = Math.max(allData.length, 1);

  return {
    totalInvites,
    totalAiGenerations,
    dailyData: allData,
    avgInvitesPerDay: Math.round(totalInvites / activeDays * 10) / 10,
    avgAiPerDay: Math.round(totalAiGenerations / activeDays * 10) / 10,
  };
}

// ---- License Management ----

export async function getLicense(): Promise<LicenseInfo | null> {
  const result = await chrome.storage.local.get('license');
  return result.license || null;
}

export async function saveLicense(license: LicenseInfo): Promise<void> {
  await chrome.storage.local.set({ license });
  // Also update tier in settings to match license
  await updateSettings({ tier: license.tier });
}

export async function clearLicense(): Promise<void> {
  await chrome.storage.local.remove('license');
  await updateSettings({ tier: 'free' });
}

// ---- Referral System ----

/** Generate a short, unique referral code for this install */
function generateReferralCode(): string {
  // 8-char alphanumeric code from random bytes
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let code = 'SP-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Get or initialize referral info */
export async function getReferralInfo(): Promise<ReferralInfo> {
  const result = await chrome.storage.local.get('referral');
  if (result.referral) return result.referral;

  // First time — generate a code
  const info: ReferralInfo = {
    myCode: generateReferralCode(),
    referralCount: 0,
    bonusAiCredits: 0,
    appliedCode: undefined,
    refereeBonus: 0,
    referralHistory: [],
  };
  await chrome.storage.local.set({ referral: info });
  return info;
}

/** Save referral info */
export async function saveReferralInfo(info: ReferralInfo): Promise<void> {
  await chrome.storage.local.set({ referral: info });
}

/**
 * Apply someone else's referral code.
 * Returns { success, message, bonusCredits }.
 * This only grants the REFEREE bonus (the referrer bonus is tracked differently — see note).
 *
 * NOTE: Since we have no backend, we can't actually notify the referrer.
 * The referrer bonus is conceptual for now. With a future backend/cloud sync,
 * we could validate codes server-side. For now, the referee gets their bonus
 * and we record it locally. The referrer would need to share their code and
 * the user manually enters it.
 */
export async function applyReferralCode(code: string): Promise<{
  success: boolean;
  message: string;
  bonusCredits: number;
}> {
  const info = await getReferralInfo();

  // Already applied a code
  if (info.appliedCode) {
    return {
      success: false,
      message: `You already used a referral code (${info.appliedCode}).`,
      bonusCredits: 0,
    };
  }

  // Can't use own code
  if (code.toUpperCase() === info.myCode.toUpperCase()) {
    return {
      success: false,
      message: "You can't use your own referral code!",
      bonusCredits: 0,
    };
  }

  // Basic format check (SP-XXXXXX)
  const codeUpper = code.toUpperCase().trim();
  if (!/^SP-[A-Z2-9]{6}$/.test(codeUpper)) {
    return {
      success: false,
      message: 'Invalid referral code format. Codes look like SP-ABC234.',
      bonusCredits: 0,
    };
  }

  // Apply the code — give referee their bonus
  info.appliedCode = codeUpper;
  info.refereeBonus = REFERRAL_REWARDS.REFEREE_BONUS;
  await saveReferralInfo(info);

  return {
    success: true,
    message: `Referral code applied! You got ${REFERRAL_REWARDS.REFEREE_BONUS} bonus AI credits.`,
    bonusCredits: REFERRAL_REWARDS.REFEREE_BONUS,
  };
}

/**
 * Simulate a referral credit (for testing/demo — in production this would
 * be triggered by backend when a new user enters this user's code).
 * Adds bonus credits to the referrer.
 */
export async function addReferralCredit(): Promise<ReferralInfo> {
  const info = await getReferralInfo();
  if (info.bonusAiCredits >= REFERRAL_REWARDS.MAX_REFERRAL_BONUS) {
    return info; // maxed out
  }
  info.referralCount += 1;
  info.bonusAiCredits = Math.min(
    info.bonusAiCredits + REFERRAL_REWARDS.CREDITS_PER_REFERRAL,
    REFERRAL_REWARDS.MAX_REFERRAL_BONUS
  );
  info.referralHistory.push(Date.now());
  await saveReferralInfo(info);
  return info;
}

/** Get total bonus AI credits from referrals (referrer + referee) */
export async function getTotalReferralBonus(): Promise<number> {
  const info = await getReferralInfo();
  return info.bonusAiCredits + info.refereeBonus;
}
