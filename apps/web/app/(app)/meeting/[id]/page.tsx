'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useMeeting } from '@/hooks/useMeetings';
import { useMeetingSocket } from '@/hooks/useMeetingSocket';
import { TranscriptViewer } from '@/components/meeting/TranscriptViewer';
import { SummaryPanel } from '@/components/meeting/SummaryPanel';
import { BotStatusBadge } from '@/components/meeting/BotStatusBadge';
import { TimerDisplay } from '@/components/meeting/TimerDisplay';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, StopCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function MeetingPage({ params }: { params: { id: string } }) {
  const { meeting, loading } = useMeeting(params.id);
  const { transcriptLines, botStatus, statusMessage, stopBot } = useMeetingSocket(params.id);

  // Show toast when summarization begins
  useEffect(() => {
    if (botStatus === 'processing') {
      toast.info('Generating AI summary…');
    }
    if (botStatus === 'done') {
      toast.success('Summary ready!');
    }
    if (botStatus === 'error') {
      toast.error(`Bot error: ${statusMessage}`);
    }
  }, [botStatus, statusMessage]);

  const isLive = botStatus === 'live';
  const currentStatus = botStatus !== 'idle' ? botStatus : (meeting?.status ?? 'idle');
  const currentSummary = meeting?.summary ?? null;

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-[500px] rounded-xl" />
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen p-4 lg:p-6 gap-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">
            {meeting?.title || 'Meeting'}
          </h1>
          {meeting?.meetUrl && (
            <a
              href={meeting.meetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 w-fit"
            >
              {meeting.meetUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-3">
          <BotStatusBadge status={currentStatus} message={statusMessage} />
          <TimerDisplay status={currentStatus} />
          {isLive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={stopBot}
              className="gap-1.5"
            >
              <StopCircle className="h-4 w-4" />
              Stop Bot
            </Button>
          )}
        </div>
      </div>

      {/* Main content: Transcript + Summary */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* Transcript */}
        <div className="rounded-xl border border-gray-200 bg-white flex flex-col min-h-0 overflow-hidden">
          <TranscriptViewer
            lines={transcriptLines.length > 0 ? transcriptLines : []}
            isLive={isLive}
          />
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-gray-200 bg-white flex flex-col min-h-0 overflow-hidden">
          <SummaryPanel
            summary={currentSummary}
            status={currentStatus}
          />
        </div>
      </div>
    </div>
  );
}
