import { useState, useMemo } from 'react';
import { ChannelData } from '@/types/channel';
import { formatNumber, formatDate } from '@/lib/youtube-parser';
import { exportAllFiles, exportCleanOnly, calculateStats, ExportStats } from '@/lib/export-files';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Search,
  Download,
  ArrowUpDown,
  BadgeCheck,
  Music2,
  ExternalLink,
  Mail,
  FileArchive,
  FileSpreadsheet,
  UserCheck,
  UserX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChannelTableProps {
  channels: ChannelData[];
  onExport?: () => void;
}

type SortField = 'title' | 'subscriberCount' | 'videoCount' | 'viewCount' | 'publishedAt' | 'verifiedType';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'success' | 'error' | 'pending' | 'clean' | 'verified' | 'artist';

export function ChannelTable({ channels }: ChannelTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('subscriberCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const stats = useMemo(() => calculateStats(channels), [channels]);

  const filteredAndSorted = useMemo(() => {
    let result = [...channels];

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(ch =>
        ch.title.toLowerCase().includes(searchLower) ||
        ch.url.toLowerCase().includes(searchLower) ||
        (ch.email && ch.email.toLowerCase().includes(searchLower))
      );
    }

    // Filter by status
    switch (statusFilter) {
      case 'success':
        result = result.filter(ch => ch.status === 'success');
        break;
      case 'error':
        result = result.filter(ch => ch.status === 'error');
        break;
      case 'pending':
        result = result.filter(ch => ch.status === 'pending' || ch.status === 'processing');
        break;
      case 'clean':
        result = result.filter(ch => ch.status === 'success' && !ch.isVerified);
        break;
      case 'verified':
        result = result.filter(ch => ch.status === 'success' && ch.verifiedType === 'verified');
        break;
      case 'artist':
        result = result.filter(ch => ch.status === 'success' && ch.verifiedType === 'artist');
        break;
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'subscriberCount':
          aVal = a.subscriberCount;
          bVal = b.subscriberCount;
          break;
        case 'videoCount':
          aVal = a.videoCount;
          bVal = b.videoCount;
          break;
        case 'viewCount':
          aVal = a.viewCount;
          bVal = b.viewCount;
          break;
        case 'publishedAt':
          aVal = new Date(a.publishedAt).getTime() || 0;
          bVal = new Date(b.publishedAt).getTime() || 0;
          break;
        case 'verifiedType':
          const order = { artist: 0, verified: 1, none: 2 };
          aVal = order[a.verifiedType] ?? 2;
          bVal = order[b.verifiedType] ?? 2;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return result;
  }, [channels, search, sortField, sortOrder, statusFilter]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getStatusIcon = (status: ChannelData['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getBadgeIcon = (channel: ChannelData) => {
    if (channel.verifiedType === 'artist') {
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20">
          <Music2 className="w-3.5 h-3.5 text-primary" />
        </div>
      );
    }
    if (channel.verifiedType === 'verified') {
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success/20">
          <BadgeCheck className="w-3.5 h-3.5 text-success" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted">
        <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    );
  };

  const handleExportAll = async () => {
    try {
      await exportAllFiles(channels);
      toast.success('Export complete! Check your downloads.');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const handleExportClean = () => {
    exportCleanOnly(channels);
    toast.success('Clean channels exported!');
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <UserCheck className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{stats.clean}</p>
              <p className="text-xs text-muted-foreground">Clean (Exportable)</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <BadgeCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">{stats.verified}</p>
              <p className="text-xs text-muted-foreground">Verified ✓</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Music2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{stats.artist}</p>
              <p className="text-xs text-muted-foreground">Artist ♪</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Mail className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">{stats.withEmail}</p>
              <p className="text-xs text-muted-foreground">With Email</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{stats.errors}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search channels, emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-secondary/50 border-border"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[160px] bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({stats.total})</SelectItem>
              <SelectItem value="clean">✓ Clean ({stats.clean})</SelectItem>
              <SelectItem value="verified">✓ Verified ({stats.verified})</SelectItem>
              <SelectItem value="artist">♪ Artist ({stats.artist})</SelectItem>
              <SelectItem value="error">✗ Errors ({stats.errors})</SelectItem>
              <SelectItem value="pending">⏳ Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportClean}
            disabled={stats.clean === 0}
            className="gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Clean CSV ({stats.clean})
          </Button>
          
          <Button
            onClick={handleExportAll}
            disabled={stats.total === 0}
            className="gap-2"
          >
            <FileArchive className="w-4 h-4" />
            Export All (ZIP)
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead className="w-[50px]">
                  <button
                    onClick={() => toggleSort('verifiedType')}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    Badge
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead className="min-w-[220px]">
                  <button
                    onClick={() => toggleSort('title')}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    Channel
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort('subscriberCount')}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    Subs
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort('videoCount')}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    Videos
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort('viewCount')}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    Views
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort('publishedAt')}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    Created
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((channel, index) => (
                <TableRow
                  key={channel.id || index}
                  className={cn(
                    'border-border transition-colors',
                    channel.status === 'processing' && 'bg-primary/5',
                    channel.status === 'error' && 'bg-destructive/5',
                    !channel.isVerified && channel.status === 'success' && 'bg-success/5',
                  )}
                >
                  <TableCell>{getStatusIcon(channel.status)}</TableCell>
                  <TableCell>{getBadgeIcon(channel)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {channel.thumbnailUrl ? (
                        <img
                          src={channel.thumbnailUrl}
                          alt={channel.title}
                          className="w-9 h-9 rounded-full object-cover bg-secondary flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-secondary flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="font-medium text-foreground truncate block max-w-[180px]">
                          {channel.title}
                        </span>
                        <a
                          href={channel.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <span className="truncate max-w-[150px]">{channel.url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                        {channel.status === 'error' && (
                          <p className="text-xs text-destructive mt-1 truncate max-w-[180px]">
                            {channel.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {channel.subscriberCount > 0 ? formatNumber(channel.subscriberCount) : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {channel.videoCount > 0 ? formatNumber(channel.videoCount) : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {channel.viewCount > 0 ? formatNumber(channel.viewCount) : '-'}
                  </TableCell>
                  <TableCell>
                    {channel.country ? (
                      <Badge variant="outline" className="border-border">
                        {channel.country}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {channel.email ? (
                      <a
                        href={`mailto:${channel.email}`}
                        className="flex items-center gap-1 text-primary hover:underline text-sm"
                      >
                        <Mail className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{channel.email}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {channel.publishedAt ? formatDate(channel.publishedAt) : '-'}
                  </TableCell>
                </TableRow>
              ))}

              {filteredAndSorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    No channels found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
