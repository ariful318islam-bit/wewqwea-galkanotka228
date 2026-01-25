import { useState, useCallback, useRef } from 'react';
import { ChannelData, ChannelInput, ProcessingState } from '@/types/channel';
import { processChannelBatch } from '@/lib/parallel-processor';
import { keyManager, ApiKeyInfo } from '@/lib/api-key-manager';
import { toast } from 'sonner';

export interface ExtendedProcessingState extends ProcessingState {
  validatingKeys: boolean;
  keyValidationProgress: number;
  validatingKeyName: string;
  keyStats: {
    total: number;
    valid: number;
    invalid: number;
    exhausted: number;
  };
  threadCount: number;
}

export function useChannelProcessor() {
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [processingState, setProcessingState] = useState<ExtendedProcessingState>({
    isProcessing: false,
    currentIndex: 0,
    totalCount: 0,
    completedCount: 0,
    errorCount: 0,
    startTime: null,
    estimatedTimeRemaining: null,
    validatingKeys: false,
    keyValidationProgress: 0,
    validatingKeyName: '',
    keyStats: { total: 0, valid: 0, invalid: 0, exhausted: 0 },
    threadCount: 5,
  });

  const abortRef = useRef({ aborted: false });

  const setThreadCount = useCallback((count: number) => {
    setProcessingState(prev => ({ ...prev, threadCount: count }));
  }, []);

  const validateApiKeys = useCallback(async (keys: string[]): Promise<boolean> => {
    setProcessingState(prev => ({
      ...prev,
      validatingKeys: true,
      keyValidationProgress: 0,
      validatingKeyName: '',
      keyStats: { total: keys.length, valid: 0, invalid: 0, exhausted: 0 },
    }));

    const result = await keyManager.validateKeys(keys, (progress, validating) => {
      setProcessingState(prev => ({
        ...prev,
        keyValidationProgress: progress,
        validatingKeyName: validating,
      }));
    });

    setProcessingState(prev => ({
      ...prev,
      validatingKeys: false,
      keyValidationProgress: 100,
      validatingKeyName: '',
      keyStats: {
        total: keys.length,
        valid: result.valid.length,
        invalid: result.invalid.length,
        exhausted: 0,
      },
    }));

    if (result.invalid.length > 0) {
      toast.warning(`${result.invalid.length} invalid API key(s) removed from pool`);
    }

    if (result.valid.length === 0) {
      toast.error('No valid API keys found');
      return false;
    }

    toast.success(`${result.valid.length} valid API key(s) ready`);
    return true;
  }, []);

  const startProcessing = useCallback(async (
    inputs: ChannelInput[],
    apiKeys: string[],
    threadCount: number
  ) => {
    if (inputs.length === 0) {
      toast.error('Please provide channels to process');
      return;
    }

    // Validate API keys first
    const keysValid = await validateApiKeys(apiKeys);
    if (!keysValid) return;

    abortRef.current = { aborted: false };

    const startTime = Date.now();
    setProcessingState(prev => ({
      ...prev,
      isProcessing: true,
      currentIndex: 0,
      totalCount: inputs.length,
      completedCount: 0,
      errorCount: 0,
      startTime,
      estimatedTimeRemaining: null,
      threadCount,
    }));

    // Initialize channels as pending
    setChannels(inputs.map((input, i) => ({
      id: `pending-${i}`,
      url: input.url,
      title: 'Waiting...',
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

    // Process with parallel workers
    await processChannelBatch(
      inputs,
      threadCount,
      {
        onChannelStart: (index) => {
          setChannels(prev => prev.map((ch, idx) =>
            idx === index ? { ...ch, status: 'processing', title: 'Loading...' } : ch
          ));
          setProcessingState(prev => ({ ...prev, currentIndex: index }));
        },
        onChannelComplete: (index, result) => {
          setChannels(prev => prev.map((ch, idx) =>
            idx === index ? result : ch
          ));
        },
        onProgress: (completed, errors, total) => {
          const elapsed = Date.now() - startTime;
          const avgTime = elapsed / (completed + errors || 1);
          const remaining = Math.round((total - completed - errors) * avgTime / 1000);

          setProcessingState(prev => ({
            ...prev,
            completedCount: completed,
            errorCount: errors,
            estimatedTimeRemaining: remaining,
          }));
        },
        onKeyExhausted: (exhaustedCount, remaining) => {
          setProcessingState(prev => ({
            ...prev,
            keyStats: {
              ...prev.keyStats,
              exhausted: exhaustedCount,
              valid: remaining,
            },
          }));
          toast.warning(`API key exhausted. ${remaining} keys remaining.`);
        },
        onAllKeysExhausted: () => {
          toast.error('All API keys have been exhausted!');
        },
      },
      abortRef.current
    );

    setProcessingState(prev => ({
      ...prev,
      isProcessing: false,
      estimatedTimeRemaining: null,
    }));

    const finalState = keyManager.getState();
    const successCount = channels.filter(c => c.status === 'success').length;
    toast.success(`Processing complete!`);
  }, [validateApiKeys]);

  const stopProcessing = useCallback(() => {
    abortRef.current.aborted = true;
    setProcessingState(prev => ({ ...prev, isProcessing: false }));
    toast.info('Processing stopped');
  }, []);

  const clearResults = useCallback(() => {
    setChannels([]);
    keyManager.reset();
    setProcessingState({
      isProcessing: false,
      currentIndex: 0,
      totalCount: 0,
      completedCount: 0,
      errorCount: 0,
      startTime: null,
      estimatedTimeRemaining: null,
      validatingKeys: false,
      keyValidationProgress: 0,
      validatingKeyName: '',
      keyStats: { total: 0, valid: 0, invalid: 0, exhausted: 0 },
      threadCount: 5,
    });
  }, []);

  const clearCache = useCallback(() => {
    localStorage.removeItem('youtube_parser_cache');
    toast.success('Cache cleared');
  }, []);

  return {
    channels,
    processingState,
    startProcessing,
    stopProcessing,
    clearResults,
    clearCache,
    setThreadCount,
  };
}
