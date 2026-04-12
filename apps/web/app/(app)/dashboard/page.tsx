'use client';

import Link from 'next/link';
import { useMeetings } from '@/hooks/useMeetings';
import { MeetingCard } from '@/components/meeting/MeetingCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Bot, Video } from 'lucide-react';

function MeetingListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { meetings, loading } = useMeetings();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <Link href="/meeting/new">
          <Button className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Meeting
          </Button>
        </Link>
      </div>

      {/* Stats bar */}
      {meetings.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Meetings', value: meetings.length },
            { label: 'Summarized', value: meetings.filter(m => m.summary).length },
            { label: 'In Progress', value: meetings.filter(m => ['joining', 'waiting', 'live'].includes(m.status)).length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Meeting list */}
      {loading ? (
        <MeetingListSkeleton />
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 mb-4">
            <Bot className="h-7 w-7 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No meetings yet</h3>
          <p className="text-sm text-gray-500 max-w-xs mb-6">
            Send a bot to your next Google Meet to automatically capture and summarize the conversation.
          </p>
          <Link href="/meeting/new">
            <Button className="gap-2">
              <Video className="h-4 w-4" />
              Start Your First Meeting
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </div>
  );
}
