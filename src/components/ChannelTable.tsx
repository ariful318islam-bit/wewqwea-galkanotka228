import { useState, useMemo } from 'react';
import { ChannelData } from '@/types/channel';
import { formatNumber, formatDate } from '@/lib/youtube-parser';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChannelTableProps {
  channels: ChannelData[];
  onExport: () => void;
}

type SortField = 'title' | 'subscriberCount' | 'videoCount' | 'viewCount' | 'publishedAt';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'success' | 'error' | 'pending';

export function ChannelTable({ channels, onExport }: ChannelTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('subscriberCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredAndSorted = useMemo(() => {
    let result = [...channels];

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(ch => 
        ch.title.toLowerCase().includes(searchLower) ||
        ch.url.toLowerCase().includes(searchLower)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(ch => ch.status === statusFilter);
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

  const getVerificationBadge = (channel: ChannelData) => {
    if (!channel.isVerified) return null;
    
    if (channel.verifiedType === 'artist') {
      return (
        <Badge variant="secondary" className="gap-1 bg-primary/20 text-primary border-primary/30">
          <Music2 className="w-3 h-3" />
          Artist
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="gap-1 bg-success/20 text-success border-success/30">
        <BadgeCheck className="w-3 h-3" />
        Verified
      </Badge>
    );
  };

  const successCount = channels.filter(c => c.status === 'success').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-secondary/50 border-border"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[140px] bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button onClick={onExport} disabled={successCount === 0} className="gap-2">
          <Download className="w-4 h-4" />
          Export Excel ({successCount})
        </Button>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[60px]">Status</TableHead>
                <TableHead className="min-w-[250px]">
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
                    Subscribers
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
                  )}
                >
                  <TableCell>{getStatusIcon(channel.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {channel.thumbnailUrl ? (
                        <img
                          src={channel.thumbnailUrl}
                          alt={channel.title}
                          className="w-10 h-10 rounded-full object-cover bg-secondary"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-secondary" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate max-w-[180px]">
                            {channel.title}
                          </span>
                          {getVerificationBadge(channel)}
                        </div>
                        <a
                          href={channel.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <span className="truncate max-w-[180px]">{channel.url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                        {channel.status === 'error' && (
                          <p className="text-xs text-destructive mt-1">{channel.errorMessage}</p>
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
                        <span className="truncate max-w-[150px]">{channel.email}</span>
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
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
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
