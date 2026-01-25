import { supabase } from '@/integrations/supabase/client';

export interface ApiKeyInfo {
  key: string;
  status: 'pending' | 'valid' | 'invalid' | 'quota_exceeded';
  error?: string;
  requestCount: number;
  lastUsed?: number;
}

export interface KeyManagerState {
  keys: ApiKeyInfo[];
  validKeys: string[];
  currentKeyIndex: number;
  isValidating: boolean;
  validationProgress: number;
}

export class ApiKeyManager {
  private keys: Map<string, ApiKeyInfo> = new Map();
  private validKeysList: string[] = [];
  private currentIndex = 0;
  private lock = false;
  private retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

  getState(): KeyManagerState {
    const keysArray = Array.from(this.keys.values());
    return {
      keys: keysArray,
      validKeys: this.validKeysList,
      currentKeyIndex: this.currentIndex,
      isValidating: false,
      validationProgress: 100,
    };
  }

  async validateKeys(
    apiKeys: string[],
    onProgress?: (progress: number, validating: string) => void
  ): Promise<{ valid: string[]; invalid: { key: string; error: string }[] }> {
    const valid: string[] = [];
    const invalid: { key: string; error: string }[] = [];

    this.keys.clear();
    this.validKeysList = [];
    this.currentIndex = 0;

    for (let i = 0; i < apiKeys.length; i++) {
      const key = apiKeys[i];
      const maskedKey = `${key.slice(0, 8)}...${key.slice(-4)}`;
      
      onProgress?.((i / apiKeys.length) * 100, maskedKey);

      this.keys.set(key, {
        key,
        status: 'pending',
        requestCount: 0,
      });

      try {
        const { data, error } = await supabase.functions.invoke('validate-api-key', {
          body: { apiKey: key },
        });

        if (error) throw error;

        if (data.isValid) {
          this.keys.set(key, {
            key,
            status: 'valid',
            requestCount: 0,
          });
          valid.push(key);
          this.validKeysList.push(key);
        } else {
          this.keys.set(key, {
            key,
            status: 'invalid',
            error: data.error,
            requestCount: 0,
          });
          invalid.push({ key: maskedKey, error: data.error || 'Invalid' });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Validation failed';
        this.keys.set(key, {
          key,
          status: 'invalid',
          error: errorMsg,
          requestCount: 0,
        });
        invalid.push({ key: maskedKey, error: errorMsg });
      }

      // Small delay between validations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    onProgress?.(100, '');
    return { valid, invalid };
  }

  getNextKey(): string | null {
    if (this.validKeysList.length === 0) return null;
    
    // Round-robin selection
    const key = this.validKeysList[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.validKeysList.length;
    
    const keyInfo = this.keys.get(key);
    if (keyInfo) {
      keyInfo.requestCount++;
      keyInfo.lastUsed = Date.now();
    }
    
    return key;
  }

  markKeyAsQuotaExceeded(key: string): void {
    const keyInfo = this.keys.get(key);
    if (keyInfo) {
      keyInfo.status = 'quota_exceeded';
      keyInfo.error = 'Quota exceeded';
    }
    
    // Remove from valid keys list
    const index = this.validKeysList.indexOf(key);
    if (index > -1) {
      this.validKeysList.splice(index, 1);
      // Adjust current index if needed
      if (this.currentIndex >= this.validKeysList.length) {
        this.currentIndex = 0;
      }
    }
  }

  hasAvailableKeys(): boolean {
    return this.validKeysList.length > 0;
  }

  getAvailableKeyCount(): number {
    return this.validKeysList.length;
  }

  getTotalKeyCount(): number {
    return this.keys.size;
  }

  getRetryDelay(attempt: number): number {
    return this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
  }

  reset(): void {
    this.keys.clear();
    this.validKeysList = [];
    this.currentIndex = 0;
  }
}

// Singleton instance
export const keyManager = new ApiKeyManager();
