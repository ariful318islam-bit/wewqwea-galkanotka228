export interface ChannelInput {
  url: string;
  customData: Record<string, string>;
  rawLine: string;
}

export interface ChannelData {
  id: string;
  url: string;
  title: string;
  description: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  publishedAt: string;
  country: string;
  thumbnailUrl: string;
  isVerified: boolean;
  verifiedType: 'none' | 'verified' | 'artist';
  email: string | null;
  customData: Record<string, string>;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMessage?: string;
}

export interface ProcessingState {
  isProcessing: boolean;
  currentIndex: number;
  totalCount: number;
  completedCount: number;
  errorCount: number;
  startTime: number | null;
  estimatedTimeRemaining: number | null;
}

export interface ApiKeyState {
  keys: string[];
  currentKeyIndex: number;
  quotaExhausted: Set<number>;
}
