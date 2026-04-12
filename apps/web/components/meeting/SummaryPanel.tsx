'use client';

import { MeetingSummary, BotStatus } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, ListTodo, Users, Tag, Sparkles } from 'lucide-react';

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-blue-600" />
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
      <Skeleton className="h-4 w-1/2" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function SummaryPanel({
  summary,
  status,
}: {
  summary: MeetingSummary | null;
  status: BotStatus;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-gray-700">AI Summary</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {status === 'processing' && <LoadingSkeleton />}

        {(status === 'live' || status === 'joining' || status === 'waiting') && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 p-8 text-center">
            <Sparkles className="h-8 w-8 opacity-40" />
            <p className="text-sm">Summary will be generated when the meeting ends.</p>
          </div>
        )}

        {(status === 'done' || status === 'idle') && !summary && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 p-8 text-center">
            <Sparkles className="h-8 w-8 opacity-40" />
            <p className="text-sm">No summary available yet.</p>
          </div>
        )}

        {summary && (
          <div className="p-4 space-y-5">
            {/* Overview */}
            <Section icon={Sparkles} title="Overview">
              <p className="text-sm text-gray-700 leading-relaxed">{summary.overview}</p>
            </Section>

            {/* Key Decisions */}
            {summary.keyDecisions?.length > 0 && (
              <Section icon={CheckCircle2} title="Key Decisions">
                <ul className="space-y-1.5">
                  {summary.keyDecisions.map((d, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Action Items */}
            {summary.actionItems?.length > 0 && (
              <Section icon={ListTodo} title="Action Items">
                <ul className="space-y-2">
                  {summary.actionItems.map((a, i) => (
                    <li key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                      <p className="text-sm text-gray-800 font-medium">{a.item}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>Owner: <span className="font-medium text-gray-700">{a.owner}</span></span>
                        {a.deadline && <span>Due: {a.deadline}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Participants */}
            {summary.participants?.length > 0 && (
              <Section icon={Users} title="Participants">
                <div className="flex flex-wrap gap-1.5">
                  {summary.participants.map((p, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-xs text-blue-700 font-medium"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Topics */}
            {summary.topics?.length > 0 && (
              <Section icon={Tag} title="Topics Discussed">
                <div className="flex flex-wrap gap-1.5">
                  {summary.topics.map((t, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
