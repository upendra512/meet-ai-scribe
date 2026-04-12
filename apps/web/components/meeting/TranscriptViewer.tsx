'use client';

import { useEffect, useRef } from 'react';
import { TranscriptLine } from '@/types';
import { formatTimestamp } from '@/lib/utils';
import { Copy, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function SpeakerChip({ name }: { name: string }) {
  // Generate a consistent color from the speaker's name
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-green-100 text-green-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
  ];
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[idx]}`}>
      {name}
    </span>
  );
}

export function TranscriptViewer({
  lines,
  isLive = false,
}: {
  lines: TranscriptLine[];
  isLive?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length]);

  function copyTranscript() {
    const text = lines
      .map((l) => `[${l.speakerLabel}] ${l.line}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Transcript copied to clipboard');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Live Transcript</span>
          {lines.length > 0 && (
            <span className="text-xs text-gray-400">{lines.length} lines</span>
          )}
        </div>
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={copyTranscript} className="h-7 px-2">
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copy
          </Button>
        )}
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <MessageSquare className="h-8 w-8 opacity-40" />
            <p className="text-sm">
              {isLive ? 'Waiting for captions…' : 'No transcript available'}
            </p>
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="flex gap-3 group">
              <span className="text-xs text-gray-400 tabular-nums pt-0.5 min-w-[48px]">
                {formatTimestamp(line.timestamp)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <SpeakerChip name={line.speakerLabel} />
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{line.line}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
