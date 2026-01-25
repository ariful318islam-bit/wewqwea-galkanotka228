import { ExtendedProcessingState } from '@/hooks/useChannelProcessor';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StopCircle, Key, Zap, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ProcessingStatusProps {
  state: ExtendedProcessingState;
  onStop: () => void;
}

export function ProcessingStatus({ state, onStop }: ProcessingStatusProps) {
  const progress = state.totalCount > 0 
    ? ((state.completedCount + state.errorCount) / state.totalCount) * 100 
    : 0;

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Key validation in progress
  if (state.validatingKeys) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Key className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Validating API Keys</h3>
                <p className="text-sm text-muted-foreground">
                  Testing {state.validatingKeyName || '...'}
                </p>
              </div>
            </div>
            <span className="text-lg font-mono text-primary">
              {Math.round(state.keyValidationProgress)}%
            </span>
          </div>
          
          <Progress value={state.keyValidationProgress} className="h-2" />
          
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-success" />
              {state.keyStats.valid} valid
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-destructive" />
              {state.keyStats.invalid} invalid
            </span>
          </div>
        </div>
      </Card>
    );
  }

  // Processing channels
  return (
    <Card className="p-6 bg-card border-border">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Processing Channels</h3>
              <p className="text-sm text-muted-foreground">
                {state.completedCount + state.errorCount} / {state.totalCount} processed
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-lg font-mono text-primary">
              {Math.round(progress)}%
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={onStop}
              className="gap-2"
            >
              <StopCircle className="w-4 h-4" />
              Stop
            </Button>
          </div>
        </div>

        <Progress value={progress} className="h-3" />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Threads:</span>
            <span className="font-medium text-foreground">{state.threadCount}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">Success:</span>
            <span className="font-medium text-success">{state.completedCount}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-muted-foreground">Errors:</span>
            <span className="font-medium text-destructive">{state.errorCount}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            <span className="text-muted-foreground">Keys:</span>
            <span className="font-medium text-foreground">
              {state.keyStats.valid}/{state.keyStats.total}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-muted-foreground">ETA:</span>
            <span className="font-medium text-foreground">
              {formatTime(state.estimatedTimeRemaining)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
