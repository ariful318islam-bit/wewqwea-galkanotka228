import { ChannelData } from '@/types/channel';
import JSZip from 'jszip';

export interface ExportStats {
  total: number;
  clean: number;
  verified: number;
  artist: number;
  errors: number;
  withEmail: number;
}

export function calculateStats(channels: ChannelData[]): ExportStats {
  const successChannels = channels.filter(c => c.status === 'success');
  const errorChannels = channels.filter(c => c.status === 'error');
  
  const clean = successChannels.filter(c => !c.isVerified);
  const verified = successChannels.filter(c => c.isVerified && c.verifiedType === 'verified');
  const artist = successChannels.filter(c => c.isVerified && c.verifiedType === 'artist');
  const withEmail = clean.filter(c => c.email);

  return {
    total: channels.length,
    clean: clean.length,
    verified: verified.length,
    artist: artist.length,
    errors: errorChannels.length,
    withEmail: withEmail.length,
  };
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function createCSVContent(channels: ChannelData[], includeHeaders = true): string {
  const customKeys = new Set<string>();
  channels.forEach(ch => {
    Object.keys(ch.customData).forEach(key => customKeys.add(key));
  });
  const customKeysList = Array.from(customKeys).sort();

  const headers = [
    'Channel ID',
    'Title',
    'URL',
    'Subscribers',
    'Videos',
    'Views',
    'Country',
    'Verified',
    'Verified Type',
    'Email',
    'Description',
    'Created At',
    'Thumbnail URL',
    ...customKeysList.map(k => k.replace('field_', 'Custom Field ')),
  ];

  const rows = channels.map(ch => [
    ch.id,
    ch.title,
    ch.url,
    ch.subscriberCount.toString(),
    ch.videoCount.toString(),
    ch.viewCount.toString(),
    ch.country,
    ch.isVerified ? 'Yes' : 'No',
    ch.verifiedType,
    ch.email || '',
    ch.description.replace(/[\r\n]+/g, ' ').slice(0, 500),
    ch.publishedAt,
    ch.thumbnailUrl,
    ...customKeysList.map(k => ch.customData[k] || ''),
  ]);

  const bom = '\uFEFF';
  if (includeHeaders) {
    return bom + [headers.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');
  }
  return bom + rows.map(row => row.map(escapeCSV).join(',')).join('\n');
}

function createLinksContent(channels: ChannelData[]): string {
  return channels.map(ch => ch.url).join('\n');
}

function createEmailsContent(channels: ChannelData[]): string {
  return channels.filter(ch => ch.email).map(ch => ch.email).join('\n');
}

function createErrorsContent(channels: ChannelData[]): string {
  return channels
    .filter(ch => ch.status === 'error')
    .map(ch => `${ch.url}\t${ch.errorMessage || 'Unknown error'}`)
    .join('\n');
}

export async function exportAllFiles(channels: ChannelData[]): Promise<void> {
  const successChannels = channels.filter(c => c.status === 'success');
  const errorChannels = channels.filter(c => c.status === 'error');
  
  const clean = successChannels.filter(c => !c.isVerified);
  const verified = successChannels.filter(c => c.isVerified && c.verifiedType === 'verified');
  const artist = successChannels.filter(c => c.isVerified && c.verifiedType === 'artist');

  const zip = new JSZip();
  const date = new Date().toISOString().slice(0, 10);

  // Clean channels (NO badges) - main export
  if (clean.length > 0) {
    zip.file('clean_channels.txt', createLinksContent(clean));
    zip.file('clean_channels.csv', createCSVContent(clean));
    
    const cleanWithEmail = clean.filter(c => c.email);
    if (cleanWithEmail.length > 0) {
      zip.file('clean_emails.txt', createEmailsContent(cleanWithEmail));
    }
  }

  // Verified channels (with checkmark badge)
  if (verified.length > 0) {
    zip.file('verified_channels.txt', createLinksContent(verified));
    zip.file('verified_channels.csv', createCSVContent(verified));
  }

  // Artist channels (with music note badge)
  if (artist.length > 0) {
    zip.file('artist_channels.txt', createLinksContent(artist));
    zip.file('artist_channels.csv', createCSVContent(artist));
  }

  // Errors
  if (errorChannels.length > 0) {
    zip.file('errors.txt', createErrorsContent(channels));
  }

  // Full statistics CSV
  zip.file('all_channels.csv', createCSVContent(successChannels));

  // Statistics summary
  const stats = calculateStats(channels);
  const statsContent = `YouTube Parser Export Statistics
Date: ${date}
================================

Total Processed: ${stats.total}
Clean Channels (exportable): ${stats.clean}
  - With Email: ${stats.withEmail}
Verified Channels: ${stats.verified}
Artist Channels: ${stats.artist}
Errors: ${stats.errors}

Success Rate: ${((stats.clean + stats.verified + stats.artist) / stats.total * 100).toFixed(1)}%
Clean Rate: ${(stats.clean / (stats.clean + stats.verified + stats.artist) * 100).toFixed(1)}%
`;
  zip.file('statistics.txt', statsContent);

  // Generate and download zip
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `youtube_export_${date}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export only clean channels (quick export)
export function exportCleanOnly(channels: ChannelData[]): void {
  const clean = channels.filter(c => c.status === 'success' && !c.isVerified);
  
  if (clean.length === 0) return;

  const blob = new Blob([createCSVContent(clean)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clean_channels_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
