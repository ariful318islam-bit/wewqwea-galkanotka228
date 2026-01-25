import { ChannelData, ChannelInput } from '@/types/channel';
import { extractChannelId } from '@/lib/youtube-parser';
import { supabase } from '@/integrations/supabase/client';
import { keyManager } from '@/lib/api-key-manager';

const CACHE_KEY = 'youtube_parser_cache';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  data: ChannelData;
  timestamp: number;
}

function getCache(): Record<string, CacheEntry> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

function setCache(cache: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    console.warn('Failed to save cache');
  }
}

function getCachedChannel(channelId: string): ChannelData | null {
  const cache = getCache();
  const entry = cache[channelId];
  if (entry && Date.now() - entry.timestamp < CACHE_EXPIRY_MS) {
    return entry.data;
  }
  return null;
}

function cacheChannel(channelId: string, data: ChannelData) {
  const cache = getCache();
  cache[channelId] = { data, timestamp: Date.now() };
  setCache(cache);
}

export interface ProcessorCallbacks {
  onChannelStart: (index: number) => void;
  onChannelComplete: (index: number, result: ChannelData) => void;
  onProgress: (completed: number, errors: number, total: number) => void;
  onKeyExhausted: (keyIndex: number, remaining: number) => void;
  onAllKeysExhausted: () => void;
}

export async function processChannelBatch(
  inputs: ChannelInput[],
  threadCount: number,
  callbacks: ProcessorCallbacks,
  abortSignal: { aborted: boolean }
): Promise<ChannelData[]> {
  const results: ChannelData[] = new Array(inputs.length);
  let completed = 0;
  let errors = 0;
  let currentIndex = 0;
  const indexLock = { current: 0 };

  const processOne = async (): Promise<void> => {
    while (!abortSignal.aborted) {
      // Get next index atomically
      const index = indexLock.current++;
      if (index >= inputs.length) break;

      const input = inputs[index];
      callbacks.onChannelStart(index);

      const result = await processChannel(input, index, abortSignal, callbacks);
      results[index] = result;

      if (result.status === 'success') {
        completed++;
      } else {
        errors++;
      }

      callbacks.onChannelComplete(index, result);
      callbacks.onProgress(completed, errors, inputs.length);

      // Check if all keys are exhausted
      if (!keyManager.hasAvailableKeys()) {
        callbacks.onAllKeysExhausted();
        abortSignal.aborted = true;
        break;
      }

      // Small delay between requests per thread
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  };

  // Start worker threads
  const workers = Array(Math.min(threadCount, inputs.length))
    .fill(null)
    .map(() => processOne());

  await Promise.all(workers);

  return results.filter(Boolean);
}

async function processChannel(
  input: ChannelInput,
  index: number,
  abortSignal: { aborted: boolean },
  callbacks: ProcessorCallbacks
): Promise<ChannelData> {
  const parsed = extractChannelId(input.url);

  if (!parsed) {
    return createErrorResult(input, index, 'Invalid URL format');
  }

  // Check cache first
  const cacheKey = `${parsed.type}:${parsed.value}`;
  const cached = getCachedChannel(cacheKey);
  if (cached) {
    return { ...cached, customData: input.customData, status: 'success' };
  }

  // Get an API key
  const apiKey = keyManager.getNextKey();
  if (!apiKey) {
    return createErrorResult(input, index, 'No available API keys');
  }

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts && !abortSignal.aborted) {
    try {
      const { data, error } = await supabase.functions.invoke('youtube-channel-info', {
        body: {
          channelIdentifier: parsed.value,
          identifierType: parsed.type,
          apiKey,
        },
      });

      if (error) throw error;

      if (data.error) {
        // Check for quota/rate limit errors
        if (
          data.error.includes('quotaExceeded') ||
          data.error.includes('rateLimitExceeded') ||
          data.error.includes('403')
        ) {
          keyManager.markKeyAsQuotaExceeded(apiKey);
          callbacks.onKeyExhausted(
            keyManager.getTotalKeyCount() - keyManager.getAvailableKeyCount(),
            keyManager.getAvailableKeyCount()
          );

          // Try with another key
          const newKey = keyManager.getNextKey();
          if (newKey) {
            attempts++;
            await new Promise(resolve => 
              setTimeout(resolve, keyManager.getRetryDelay(attempts))
            );
            continue;
          } else {
            return createErrorResult(input, index, 'All API keys exhausted');
          }
        }
        throw new Error(data.error);
      }

      const channelData: ChannelData = {
        id: data.channelId,
        url: input.url,
        title: data.title,
        description: data.description,
        subscriberCount: data.subscriberCount,
        videoCount: data.videoCount,
        viewCount: data.viewCount,
        publishedAt: data.publishedAt,
        country: data.country,
        thumbnailUrl: data.thumbnailUrl,
        isVerified: data.isVerified,
        verifiedType: data.verifiedType,
        email: data.email,
        customData: input.customData,
        status: 'success',
      };

      cacheChannel(cacheKey, channelData);
      return channelData;

    } catch (err) {
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => 
          setTimeout(resolve, keyManager.getRetryDelay(attempts))
        );
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return createErrorResult(input, index, errorMessage);
      }
    }
  }

  return createErrorResult(input, index, 'Max retries exceeded');
}

function createErrorResult(input: ChannelInput, index: number, errorMessage: string): ChannelData {
  return {
    id: `error-${index}`,
    url: input.url,
    title: 'Error',
    description: '',
    subscriberCount: 0,
    videoCount: 0,
    viewCount: 0,
    publishedAt: '',
    country: '',
    thumbnailUrl: '',
    isVerified: false,
    verifiedType: 'none',
    email: null,
    customData: input.customData,
    status: 'error',
    errorMessage,
  };
}
