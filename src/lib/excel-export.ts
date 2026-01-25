import { ChannelData } from '@/types/channel';

export function exportToExcel(channels: ChannelData[]): void {
  const successChannels = channels.filter(c => c.status === 'success');
  
  if (successChannels.length === 0) {
    return;
  }

  // Get all custom field keys
  const customKeys = new Set<string>();
  successChannels.forEach(ch => {
    Object.keys(ch.customData).forEach(key => customKeys.add(key));
  });
  const customKeysList = Array.from(customKeys).sort();

  // Create CSV content
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

  const rows = successChannels.map(ch => [
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

  // Escape CSV values
  const escapeCSV = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
  
  // Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `youtube_channels_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
