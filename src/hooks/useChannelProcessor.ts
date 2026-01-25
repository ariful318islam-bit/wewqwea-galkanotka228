import { useState, useCallback, useRef } from 'react';
import { ChannelData, ChannelInput, ProcessingState, ApiKeyState } from '@/types/channel';
import { extractChannelId } from '@/lib/youtube-parser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export function useChannelProcessor() {
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    currentIndex: 0,
    totalCount: 0,
    completedCount: 0,
    errorCount: 0,
    startTime: null,
    estimatedTimeRemaining: null,
  });
  
  const abortRef = useRef(false);
  const apiKeysRef = useRef<ApiKeyState>({
    keys: [],
    currentKeyIndex: 0,
    quotaExhausted: new Set(),
  });

  const processChannel = useCallback(async (
    input: ChannelInput,
    index: number
  ): Promise<ChannelData> => {
    const parsed = extractChannelId(input.url);
    
    if (!parsed) {
      return {
        id: `error-${index}`,
        url: input.url,
        title: 'Unknown',
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
        errorMessage: 'Invalid URL format',
      };
    }

    // Check cache first
    const cacheKey = `${parsed.type}:${parsed.value}`;
    const cached = getCachedChannel(cacheKey);
    if (cached) {
      return { ...cached, customData: input.customData, status: 'success' };
    }

    // Get next available API key
    const apiKeys = apiKeysRef.current;
    let attempts = 0;
    
    while (attempts < apiKeys.keys.length) {
      if (apiKeys.quotaExhausted.size >= apiKeys.keys.length) {
        throw new Error('All API keys exhausted');
      }
      
      if (apiKeys.quotaExhausted.has(apiKeys.currentKeyIndex)) {
        apiKeys.currentKeyIndex = (apiKeys.currentKeyIndex + 1) % apiKeys.keys.length;
        attempts++;
        continue;
      }
      
      break;
    }

    const currentKey = apiKeys.keys[apiKeys.currentKeyIndex];

    try {
      const { data, error } = await supabase.functions.invoke('youtube-channel-info', {
        body: {
          channelIdentifier: parsed.value,
          identifierType: parsed.type,
          apiKey: currentKey,
        },
      });

      if (error) throw error;
      
      if (data.error) {
        if (data.error.includes('quotaExceeded')) {
          apiKeys.quotaExhausted.add(apiKeys.currentKeyIndex);
          apiKeys.currentKeyIndex = (apiKeys.currentKeyIndex + 1) % apiKeys.keys.length;
          toast.warning(`API key #${apiKeys.currentKeyIndex + 1} quota exhausted, switching...`);
          return processChannel(input, index);
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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
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
  }, []);

  const startProcessing = useCallback(async (
    inputs: ChannelInput[],
    apiKeys: string[]
  ) => {
    if (inputs.length === 0 || apiKeys.length === 0) {
      toast.error('Please provide channels and API keys');
      return;
    }

    abortRef.current = false;
    apiKeysRef.current = {
      keys: apiKeys,
      currentKeyIndex: 0,
      quotaExhausted: new Set(),
    };

    setProcessingState({
      isProcessing: true,
      currentIndex: 0,
      totalCount: inputs.length,
      completedCount: 0,
      errorCount: 0,
      startTime: Date.now(),
      estimatedTimeRemaining: null,
    });

    setChannels(inputs.map((input, i) => ({
      id: `pending-${i}`,
      url: input.url,
      title: 'Loading...',
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
      status: 'pending',
    })));

    const results: ChannelData[] = [];
    let completedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < inputs.length; i++) {
      if (abortRef.current) break;

      setProcessingState(prev => ({
        ...prev,
        currentIndex: i,
      }));

      setChannels(prev => prev.map((ch, idx) => 
        idx === i ? { ...ch, status: 'processing' } : ch
      ));

      const result = await processChannel(inputs[i], i);
      results.push(result);

      if (result.status === 'success') {
        completedCount++;
      } else {
        errorCount++;
      }

      setChannels(prev => prev.map((ch, idx) => 
        idx === i ? result : ch
      ));

      const elapsed = Date.now() - (Date.now() - (inputs.length - i - 1) * (Date.now() / (i + 1)));
      const avgTime = elapsed / (i + 1);
      const remaining = Math.round((inputs.length - i - 1) * avgTime / 1000);

      setProcessingState(prev => ({
        ...prev,
        completedCount,
        errorCount,
        estimatedTimeRemaining: remaining,
      }));

      // Small delay to avoid rate limiting
      if (i < inputs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setProcessingState(prev => ({
      ...prev,
      isProcessing: false,
      estimatedTimeRemaining: null,
    }));

    toast.success(`Processing complete: ${completedCount} success, ${errorCount} errors`);
  }, [processChannel]);

  const stopProcessing = useCallback(() => {
    abortRef.current = true;
    setProcessingState(prev => ({ ...prev, isProcessing: false }));
    toast.info('Processing stopped');
  }, []);

  const clearResults = useCallback(() => {
    setChannels([]);
    setProcessingState({
      isProcessing: false,
      currentIndex: 0,
      totalCount: 0,
      completedCount: 0,
      errorCount: 0,
      startTime: null,
      estimatedTimeRemaining: null,
    });
  }, []);

  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    toast.success('Cache cleared');
  }, []);

  return {
    channels,
    processingState,
    startProcessing,
    stopProcessing,
    clearResults,
    clearCache,
  };
}
