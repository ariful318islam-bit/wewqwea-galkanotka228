import { useState, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { ChannelTable } from '@/components/ChannelTable';
import { useChannelProcessor } from '@/hooks/useChannelProcessor';
import { parseChannelsFile, parseApiKeysFile } from '@/lib/youtube-parser';
import { ChannelInput } from '@/types/channel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Key, Users, Play, Trash2, RefreshCw, Youtube, Zap } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [channelInputs, setChannelInputs] = useState<ChannelInput[]>([]);
  const [threadCount, setThreadCount] = useState(5);

  const {
    channels,
    processingState,
    startProcessing,
    stopProcessing,
    clearResults,
    clearCache,
  } = useChannelProcessor();

  const handleApiKeysLoaded = useCallback((content: string) => {
    if (!content) {
      setApiKeys([]);
      return;
    }
    const keys = parseApiKeysFile(content);
    setApiKeys(keys);
    toast.success(`Loaded ${keys.length} API keys`);
  }, []);

  const handleChannelsLoaded = useCallback((content: string) => {
    if (!content) {
      setChannelInputs([]);
      return;
    }
    const inputs = parseChannelsFile(content);
    setChannelInputs(inputs);
    toast.success(`Loaded ${inputs.length} channels`);
  }, []);

  const handleStart = () => {
    if (apiKeys.length === 0) {
      toast.error('Please upload API keys file');
      return;
    }
    if (channelInputs.length === 0) {
      toast.error('Please upload channels file');
      return;
    }
    startProcessing(channelInputs, apiKeys, threadCount);
  };

  const canStart = apiKeys.length > 0 && channelInputs.length > 0 && !processingState.isProcessing && !processingState.validatingKeys;
  const isWorking = processingState.isProcessing || processingState.validatingKeys;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary glow-primary">
                <Youtube className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">YouTube Parser</h1>
                <p className="text-xs text-muted-foreground">Channel Data Extractor</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCache}
                className="text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear Cache
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-8">
        {/* Upload Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <FileUpload
            label="API Keys"
            description="Upload api.txt with YouTube Data API keys (one per line)"
            icon={<Key className="w-6 h-6" />}
            onFileLoaded={handleApiKeysLoaded}
            isLoaded={apiKeys.length > 0}
            lineCount={apiKeys.length}
          />

          <FileUpload
            label="Channels List"
            description="Upload channels.txt with URLs and custom data (tab-separated)"
            icon={<Users className="w-6 h-6" />}
            onFileLoaded={handleChannelsLoaded}
            isLoaded={channelInputs.length > 0}
            lineCount={channelInputs.length}
          />
        </div>

        {/* Thread Settings & Controls */}
        <Card className="p-6 mb-6 bg-card border-border">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Thread Count Slider */}
            <div className="flex-1 max-w-md">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2 text-foreground">
                  <Zap className="w-4 h-4 text-primary" />
                  Parallel Threads
                </Label>
                <span className="text-lg font-mono font-bold text-primary">{threadCount}</span>
              </div>
              <Slider
                value={[threadCount]}
                onValueChange={(v) => setThreadCount(v[0])}
                min={1}
                max={30}
                step={1}
                className="w-full"
                disabled={isWorking}
              />
              <p className="text-xs text-muted-foreground mt-1">
                More threads = faster processing, but higher API usage
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                onClick={handleStart}
                disabled={!canStart}
                className="gap-2 glow-primary"
              >
                <Play className="w-5 h-5" />
                Start Processing
              </Button>

              {channels.length > 0 && !isWorking && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={clearResults}
                  className="gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Clear Results
                </Button>
              )}
            </div>
          </div>

          {canStart && (
            <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
              Ready to process <span className="text-primary font-medium">{channelInputs.length}</span> channels
              using <span className="text-primary font-medium">{apiKeys.length}</span> API keys
              with <span className="text-primary font-medium">{threadCount}</span> parallel threads
            </p>
          )}
        </Card>

        {/* Processing Status */}
        {isWorking && (
          <div className="mb-8">
            <ProcessingStatus state={processingState} onStop={stopProcessing} />
          </div>
        )}

        {/* Results Table */}
        {channels.length > 0 && (
          <section className="animate-fade-in">
            <ChannelTable channels={channels} />
          </section>
        )}

        {/* Empty State */}
        {channels.length === 0 && !isWorking && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary/50 text-muted-foreground mb-4">
              <Youtube className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Upload files to get started
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Upload your API keys and channels list, then click "Start Processing"
              to extract channel data. Only <span className="text-success font-medium">clean channels</span> (without verification badges) will be exported.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
