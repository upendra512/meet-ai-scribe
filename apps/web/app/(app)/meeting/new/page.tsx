import { MeetingForm } from '@/components/meeting/MeetingForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot } from 'lucide-react';

export default function NewMeetingPage() {
  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Meeting</h1>
        <p className="text-sm text-gray-500 mt-0.5">Deploy a bot to capture and summarize your meeting.</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Bot className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Send MeetScribe Bot</CardTitle>
              <CardDescription>Bot will join, listen, and summarize.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <MeetingForm />
        </CardContent>
      </Card>
    </div>
  );
}
