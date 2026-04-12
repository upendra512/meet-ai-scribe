'use client';

import { BotStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<BotStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'; dot: string }> = {
  idle: { label: 'Idle', variant: 'secondary', dot: 'bg-gray-400' },
  joining: { label: 'Joining…', variant: 'warning', dot: 'bg-yellow-500 animate-pulse' },
  waiting: { label: 'Waiting to be admitted', variant: 'warning', dot: 'bg-yellow-500 animate-pulse' },
  live: { label: 'Live', variant: 'success', dot: 'bg-green-500 animate-pulse' },
  processing: { label: 'Processing…', variant: 'default', dot: 'bg-blue-500 animate-pulse' },
  done: { label: 'Done', variant: 'outline', dot: 'bg-gray-400' },
  error: { label: 'Error', variant: 'destructive', dot: 'bg-red-500' },
};

export function BotStatusBadge({
  status,
  message,
  className,
}: {
  status: BotStatus;
  message?: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge variant={config.variant} className="gap-1.5 px-2.5 py-1">
        <span className={cn('h-2 w-2 rounded-full', config.dot)} />
        {config.label}
      </Badge>
      {message && <span className="text-xs text-gray-500 truncate max-w-[200px]">{message}</span>}
    </div>
  );
}
