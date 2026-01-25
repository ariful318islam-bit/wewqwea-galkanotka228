import { ChannelInput } from "@/types/channel";

// Parse different YouTube channel URL formats
export function extractChannelId(url: string): { type: 'id' | 'handle' | 'custom' | 'user'; value: string } | null {
  const trimmedUrl = url.trim();
  
  // Direct channel ID (UC...)
  const channelIdMatch = trimmedUrl.match(/(?:youtube\.com\/channel\/|^)(UC[\w-]{22})(?:\/|$|\?)?/i);
  if (channelIdMatch) {
    return { type: 'id', value: channelIdMatch[1] };
  }
  
  // Handle format (@username)
  const handleMatch = trimmedUrl.match(/(?:youtube\.com\/@|^@)([\w.-]+)(?:\/|$|\?)?/i);
  if (handleMatch) {
    return { type: 'handle', value: handleMatch[1] };
  }
  
  // Custom URL (youtube.com/c/name or youtube.com/name)
  const customMatch = trimmedUrl.match(/youtube\.com\/(?:c\/)?([^\/\s?]+)(?:\/|$|\?)?/i);
  if (customMatch && !['watch', 'playlist', 'channel', 'user', 'feed', 'gaming', 'shorts'].includes(customMatch[1].toLowerCase())) {
    return { type: 'custom', value: customMatch[1] };
  }
  
  // Legacy user format
  const userMatch = trimmedUrl.match(/youtube\.com\/user\/([\w.-]+)(?:\/|$|\?)?/i);
  if (userMatch) {
    return { type: 'user', value: userMatch[1] };
  }
  
  return null;
}

// Parse channels file
export function parseChannelsFile(content: string): ChannelInput[] {
  const lines = content.split('\n').filter(line => line.trim());
  const channels: ChannelInput[] = [];
  
  for (const line of lines) {
    const parts = line.split('\t');
    const url = parts[0]?.trim();
    
    if (!url) continue;
    
    const customData: Record<string, string> = {};
    for (let i = 1; i < parts.length; i++) {
      customData[`field_${i}`] = parts[i]?.trim() || '';
    }
    
    channels.push({
      url,
      customData,
      rawLine: line,
    });
  }
  
  return channels;
}

// Parse API keys file
export function parseApiKeysFile(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

// Format subscriber count
export function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Format date
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
