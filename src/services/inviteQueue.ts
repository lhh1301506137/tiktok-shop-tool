/**
 * ShopPilot - Batch Invite Queue Service
 * Manages queued invitations with rate limiting, retry, progress tracking,
 * and persistence (survives Service Worker restarts).
 */

import { Creator } from '@/types';
import { getSettings, incrementUsage, updateCreator, checkDailyInviteLimit } from '@/utils/storage';
import { generateInviteMessage } from '@/services/ai';

export interface InviteJob {
  id: string;
  creator: Creator;
  message: string;
  status: 'queued' | 'processing' | 'success' | 'failed' | 'skipped';
  retries: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface InviteQueueState {
  jobs: InviteJob[];
  isRunning: boolean;
  currentIndex: number;
  stats: {
    total: number;
    completed: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  /** Set to true when state was recovered after a SW restart */
  recovered?: boolean;
}

const MAX_RETRIES = 2;
const MIN_DELAY_MS = 3000;   // Minimum 3s between invites (anti-ban)
const MAX_DELAY_MS = 8000;   // Maximum 8s between invites (randomized)
const JITTER_MS = 2000;      // Random jitter
const STORAGE_KEY = 'inviteQueueState';

let queueState: InviteQueueState = {
  jobs: [],
  isRunning: false,
  currentIndex: 0,
  stats: { total: 0, completed: 0, succeeded: 0, failed: 0, skipped: 0 },
};

// Listeners for UI updates
type ProgressListener = (state: InviteQueueState) => void;
const listeners: ProgressListener[] = [];

export function onQueueProgress(fn: ProgressListener) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyListeners() {
  for (const fn of listeners) {
    try { fn({ ...queueState }); } catch {}
  }
}

function randomDelay(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + Math.random() * JITTER_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Persistence ----

/** Save current queue state to chrome.storage.session (survives SW restart, cleared on browser close) */
async function persistState(): Promise<void> {
  try {
    await chrome.storage.session.set({ [STORAGE_KEY]: queueState });
  } catch {
    // chrome.storage.session may not be available in all environments
    console.warn('[ShopPilot] Failed to persist queue state');
  }
}

/** Clear persisted state (after queue finishes) */
async function clearPersistedState(): Promise<void> {
  try {
    await chrome.storage.session.remove(STORAGE_KEY);
  } catch {}
}

/** Recover queue state after SW restart. Returns true if there's unfinished work. */
export async function recoverQueue(): Promise<boolean> {
  try {
    const result = await chrome.storage.session.get(STORAGE_KEY);
    const saved: InviteQueueState | undefined = result[STORAGE_KEY];

    if (!saved || !saved.isRunning) return false;

    // Mark any 'processing' job back to 'queued' for retry
    for (const job of saved.jobs) {
      if (job.status === 'processing') {
        job.status = 'queued';
      }
    }

    saved.recovered = true;
    queueState = saved;
    notifyListeners();

    console.log(`[ShopPilot] Recovered invite queue: ${saved.stats.completed}/${saved.stats.total} completed, resuming from index ${saved.currentIndex}`);

    // Resume processing
    processQueue().catch(console.error);
    return true;
  } catch {
    return false;
  }
}

// ---- Public API ----

/** Get current queue state (for polling from UI) */
export function getQueueState(): InviteQueueState {
  return { ...queueState };
}

/** Start a batch invite job */
export async function startBatchInvite(
  creators: Creator[],
  tone: string = 'professional'
): Promise<{ success: boolean; error?: string }> {
  if (queueState.isRunning) {
    return { success: false, error: 'A batch invite is already running' };
  }

  // Load seller's product info for AI generation
  const settings = await getSettings();
  const sellerProduct = settings.productName
    ? { name: settings.productName, description: settings.productDescription, commission: settings.commissionRate }
    : undefined;

  // Generate messages for all creators via AI
  const jobs: InviteJob[] = [];
  for (const creator of creators) {
    try {
      const msg = await generateInviteMessage(creator, tone as any, undefined, sellerProduct);
      if ('error' in msg) {
        jobs.push({
          id: `invite-${creator.id}-${Date.now()}`,
          creator,
          message: '',
          status: 'skipped',
          retries: 0,
          error: (msg as any).error,
        });
      } else {
        jobs.push({
          id: `invite-${creator.id}-${Date.now()}`,
          creator,
          message: msg.body,
          status: 'queued',
          retries: 0,
        });
      }
    } catch (e) {
      jobs.push({
        id: `invite-${creator.id}-${Date.now()}`,
        creator,
        message: '',
        status: 'skipped',
        retries: 0,
        error: `AI generation failed: ${(e as Error).message}`,
      });
    }
  }

  queueState = {
    jobs,
    isRunning: true,
    currentIndex: 0,
    stats: {
      total: jobs.length,
      completed: jobs.filter(j => j.status === 'skipped').length,
      succeeded: 0,
      failed: 0,
      skipped: jobs.filter(j => j.status === 'skipped').length,
    },
  };

  notifyListeners();
  await persistState();

  // Start processing in background (non-blocking)
  processQueue().catch(console.error);

  return { success: true };
}

/** Stop the running batch */
export function stopBatchInvite() {
  queueState.isRunning = false;
  notifyListeners();
  persistState();
}

// ---- Core Queue Processor ----

async function processQueue() {
  while (queueState.isRunning && queueState.currentIndex < queueState.jobs.length) {
    const job = queueState.jobs[queueState.currentIndex];

    if (job.status === 'skipped') {
      queueState.currentIndex++;
      continue;
    }

    // Check per-invite limit
    const inviteLimitCheck = await checkDailyInviteLimit();
    if (!inviteLimitCheck.allowed) {
      // Skip all remaining jobs
      for (let i = queueState.currentIndex; i < queueState.jobs.length; i++) {
        const j = queueState.jobs[i];
        if (j.status === 'queued') {
          j.status = 'skipped';
          j.error = `Daily invite limit reached (${inviteLimitCheck.limit}). Upgrade to send more.`;
          j.completedAt = Date.now();
          queueState.stats.skipped++;
          queueState.stats.completed++;
        }
      }
      notifyListeners();
      await persistState();
      break;
    }

    job.status = 'processing';
    job.startedAt = Date.now();
    notifyListeners();
    await persistState();

    const success = await executeInvite(job);

    if (success) {
      job.status = 'success';
      job.completedAt = Date.now();
      queueState.stats.succeeded++;
      queueState.stats.completed++;

      // Update creator status in storage
      await updateCreator(job.creator.id, {
        inviteStatus: 'pending',
        invitedAt: Date.now(),
      });
      await incrementUsage('invitesSentToday');
    } else if (job.retries < MAX_RETRIES) {
      job.retries++;
      job.status = 'queued';
      // Don't advance index — retry same job
      notifyListeners();
      await persistState();
      await sleep(randomDelay());
      continue;
    } else {
      job.status = 'failed';
      job.completedAt = Date.now();
      queueState.stats.failed++;
      queueState.stats.completed++;
    }

    notifyListeners();
    await persistState();
    queueState.currentIndex++;

    // Rate-limiting delay between invites
    if (queueState.isRunning && queueState.currentIndex < queueState.jobs.length) {
      await sleep(randomDelay());
    }
  }

  queueState.isRunning = false;
  queueState.recovered = false;
  notifyListeners();
  await clearPersistedState();
}

/** Execute a single invite by sending message to content script */
async function executeInvite(job: InviteJob): Promise<boolean> {
  try {
    // Find TikTok Seller Center tab
    const tabs = await chrome.tabs.query({ url: '*://seller*.tiktok.com/*' });
    if (tabs.length === 0 || !tabs[0].id) {
      job.error = 'No TikTok Seller Center tab found';
      return false;
    }

    const tabId = tabs[0].id;

    // Send autofill command to content script
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'EXECUTE_INVITE',
      payload: {
        creatorId: job.creator.id,
        creatorUsername: job.creator.username,
        message: job.message,
      },
    });

    if (response?.success) {
      return true;
    } else {
      job.error = response?.error || 'Invite execution failed';
      return false;
    }
  } catch (e) {
    job.error = (e as Error).message;
    return false;
  }
}
