'use client';

import Link from 'next/link';
import { Meeting } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { BotStatusBadge } from './BotStatusBadge';
import { formatDate, formatDuration, truncate } from '@/lib/utils';
import { Video, Clock, FileText } from 'lucide-react';

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <Link href={`/meeting/${meeting.id}`}>
      <Card className="hover:shadow-md transition-all duration-200 hover:border-blue-200 cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                {meeting.title || 'Untitled Meeting'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <Video className="h-3 w-3" />
                <span className="truncate">{meeting.meetUrl}</span>
              </p>
            </div>
            <BotStatusBadge status={meeting.status} />
          </div>

          {meeting.summary?.overview && (
            <p className="text-sm text-gray-600 mt-3 leading-relaxed line-clamp-2">
              {truncate(meeting.summary.overview, 150)}
            </p>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(meeting.createdAt)}
            </span>
            {meeting.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(meeting.duration)}
              </span>
            )}
            {meeting.transcriptLines > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {meeting.transcriptLines} lines
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
