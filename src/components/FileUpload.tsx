import { useCallback, useState } from 'react';
import { Upload, FileText, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  label: string;
  description: string;
  accept?: string;
  onFileLoaded: (content: string) => void;
  icon?: React.ReactNode;
  isLoaded?: boolean;
  lineCount?: number;
}

export function FileUpload({
  label,
  description,
  accept = '.txt',
  onFileLoaded,
  icon,
  isLoaded = false,
  lineCount,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onFileLoaded(content);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }, [onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClear = useCallback(() => {
    setFileName(null);
    onFileLoaded('');
  }, [onFileLoaded]);

  return (
    <div
      className={cn(
        'relative p-6 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer group',
        isDragging && 'border-primary bg-primary/5 scale-[1.02]',
        isLoaded ? 'border-success/50 bg-success/5' : 'border-border hover:border-primary/50 hover:bg-card/50',
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      
      <div className="flex items-start gap-4">
        <div className={cn(
          'p-3 rounded-lg transition-colors',
          isLoaded ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground group-hover:text-primary group-hover:bg-primary/10'
        )}>
          {isLoaded ? <Check className="w-6 h-6" /> : (icon || <Upload className="w-6 h-6" />)}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground mb-1">{label}</h3>
          <p className="text-sm text-muted-foreground mb-2">{description}</p>
          
          {fileName && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-foreground truncate">{fileName}</span>
              {lineCount !== undefined && (
                <span className="text-muted-foreground">({lineCount} entries)</span>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClear();
                }}
                className="ml-auto p-1 hover:bg-destructive/20 rounded transition-colors"
              >
                <X className="w-4 h-4 text-destructive" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
