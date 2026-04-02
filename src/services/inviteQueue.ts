/**
 * ShopPilot - Batch Invite Queue Service
 * Manages queued invitations with rate limiting, retry, and progress tracking.
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
}

const MAX_RETRIES = 2;
const MIN_DELAY_MS = 3000;   // Minimum 3s between invites (anti-ban)
const MAX_DELAY_MS = 8000;   // Maximum 8s between invites (randomized)
const JITTER_MS = 2000;      // Random jitter

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

  // Generate messages for all creators via AI
  const jobs: InviteJob[] = [];
  for (const creator of creators) {
    try {
      const msg = await generateInviteMessage(creator, tone as any);
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

  // Start processing in background (non-blocking)
  processQueue().catch(console.error);

  return { success: true };
}

/** Stop the running batch */
export function stopBatchInvite() {
  queueState.isRunning = false;
  notifyListeners();
}

/** Core queue processor */
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
      job.status = 'skipped';
      job.error = `Daily invite limit reached (${inviteLimitCheck.limit}). Upgrade to send more.`;
      job.completedAt = Date.now();
      queueState.stats.skipped++;
      queueState.stats.completed++;
      notifyListeners();
      queueState.currentIndex++;
      continue;
    }

    job.status = 'processing';
    job.startedAt = Date.now();
    notifyListeners();

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
      await sleep(randomDelay());
      continue;
    } else {
      job.status = 'failed';
      job.completedAt = Date.now();
      queueState.stats.failed++;
      queueState.stats.completed++;
    }

    notifyListeners();
    queueState.currentIndex++;

    // Rate-limiting delay between invites
    if (queueState.isRunning && queueState.currentIndex < queueState.jobs.length) {
      await sleep(randomDelay());
    }
  }

  queueState.isRunning = false;
  notifyListeners();
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
