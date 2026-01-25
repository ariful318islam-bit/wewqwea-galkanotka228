import { ProcessingState } from '@/types/channel';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, Square, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface ProcessingStatusProps {
  state: ProcessingState;
  onStop: () => void;
}

export function ProcessingStatus({ state, onStop }: ProcessingStatusProps) {
  const progress = state.totalCount > 0 
    ? ((state.completedCount + state.errorCount) / state.totalCount) * 100 
    : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="glass rounded-xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <div className="absolute inset-0 w-6 h-6 bg-primary/20 rounded-full animate-ping" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Processing Channels</h3>
            <p className="text-sm text-muted-foreground">
              {state.currentIndex + 1} of {state.totalCount}
            </p>
          </div>
        </div>
        
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={onStop}
          className="gap-2"
        >
          <Square className="w-4 h-4" />
          Stop
        </Button>
      </div>
      
      <Progress value={progress} className="h-2 mb-4" />
      
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 rounded-lg bg-secondary/50">
          <div className="flex items-center justify-center gap-2 text-success mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">{state.completedCount}</span>
          </div>
          <p className="text-xs text-muted-foreground">Success</p>
        </div>
        
        <div className="p-3 rounded-lg bg-secondary/50">
          <div className="flex items-center justify-center gap-2 text-destructive mb-1">
            <XCircle className="w-4 h-4" />
            <span className="font-semibold">{state.errorCount}</span>
          </div>
          <p className="text-xs text-muted-foreground">Errors</p>
        </div>
        
        <div className="p-3 rounded-lg bg-secondary/50">
          <div className="flex items-center justify-center gap-2 text-primary mb-1">
            <Clock className="w-4 h-4" />
            <span className="font-semibold">
              {state.estimatedTimeRemaining !== null 
                ? formatTime(state.estimatedTimeRemaining) 
                : '--'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Remaining</p>
        </div>
      </div>
    </div>
  );
}
