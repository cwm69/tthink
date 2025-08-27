'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { getHistoryForDisplay, hasHistory, getHistoryCount, isShowingHistoricalVersion, getCurrentVersionDescription } from '@/lib/node-history';
import { HistoryIcon, RotateCcwIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type NodeHistoryMenuProps = {
  nodeData: any;
  onRevert: (entryId: string) => void;
  disabled?: boolean;
  onInteraction?: () => void;
};

export const NodeHistoryMenu = ({ nodeData, onRevert, disabled = false, onInteraction }: NodeHistoryMenuProps) => {
  if (!hasHistory(nodeData)) {
    return null;
  }

  const history = getHistoryForDisplay(nodeData);
  const count = getHistoryCount(nodeData);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative rounded-full"
          disabled={disabled}
          title={`${count} version${count !== 1 ? 's' : ''} available`}
          onMouseDown={(e) => {
            e.stopPropagation();
            onInteraction?.(); // Signal that we're interacting with the dropdown
          }}
          onClick={(e) => {
            e.stopPropagation();
            onInteraction?.();
          }}
        >
          <HistoryIcon size={12} />
          {count > 0 && (
            <Badge 
              variant="secondary" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center"
            >
              {count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-80"
        onCloseAutoFocus={(e) => {
          // Prevent focus from automatically returning to trigger button
          // Instead, let the textarea keep focus
          e.preventDefault();
          
          // Find and refocus the textarea
          const textarea = document.querySelector('[data-id] textarea');
          if (textarea) {
            setTimeout(() => (textarea as HTMLElement).focus(), 10);
          }
        }}
        onInteractOutside={(e) => {
          // Only close if clicking truly outside, not on textarea or other node elements
          const target = e.target as Element;
          const textarea = target.closest('textarea');
          const nodeElement = target.closest('[data-id]');
          
          if (textarea || nodeElement) {
            e.preventDefault();
          }
        }}
      >
        <DropdownMenuLabel className="flex items-center gap-2">
          <HistoryIcon size={14} />
          Version History
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {history.length <= 1 ? (
          <DropdownMenuItem disabled>
            No previous versions
          </DropdownMenuItem>
        ) : (
          history.map((entry, index) => (
            <DropdownMenuItem
              key={entry.id}
              onSelect={() => {
                onInteraction?.(); // Signal interaction when selecting
                onRevert(entry.id);
              }}
              className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                entry.isCurrent ? 'bg-muted/50' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {entry.isCurrent ? (
                    <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" title="Currently selected" />
                  ) : entry.isLatest ? (
                    <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" title="Latest version" />
                  ) : (
                    <RotateCcwIcon size={12} className="text-muted-foreground" />
                  )}
                  <div className="flex items-center gap-1">
                    <Badge variant={entry.isCurrent ? "default" : "outline"} className="text-xs">
                      {entry.isCurrent ? 'Current' : (entry.isLatest ? 'Latest' : entry.type)}
                    </Badge>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {entry.isLatest ? 'Most recent' : formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-left line-clamp-2 w-full">
                {entry.description}
              </p>
              <div className="flex gap-1">
                {entry.metadata?.modelId && (
                  <Badge variant="secondary" className="text-xs">
                    {entry.metadata.modelId}
                  </Badge>
                )}
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};