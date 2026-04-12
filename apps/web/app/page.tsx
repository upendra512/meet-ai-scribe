'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Bot, Sparkles, Mic, FileText, CheckCircle2, ArrowRight, Video } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const FEATURES = [
  {
    icon: Bot,
    title: 'Automated Bot',
    desc: 'Sends a headless bot to join any Google Meet link on your behalf.',
  },
  {
    icon: Mic,
    title: 'Live Transcription',
    desc: 'Captures live captions in real-time using Google Meet\'s own transcript engine.',
  },
  {
    icon: Sparkles,
    title: 'AI Summaries',
    desc: 'Gemini AI turns raw transcript into a structured, actionable summary.',
  },
  {
    icon: FileText,
    title: 'Action Items',
    desc: 'Extracts key decisions, tasks, and participants automatically.',
  },
];

const HOW_IT_WORKS = [
  { step: '1', text: 'Paste your Google Meet link' },
  { step: '2', text: 'Bot joins and enables live captions' },
  { step: '3', text: 'Transcript streams to your dashboard in real time' },
  { step: '4', text: 'When the call ends, Gemini generates a summary' },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect signed-in users straight to the dashboard
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">MeetScribe</span>
          </div>
          <Link href="/login">
            <Button size="sm" className="gap-1.5">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-sm text-blue-700 font-medium mb-6">
          <Sparkles className="h-4 w-4" />
          Powered by Gemini AI
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-5">
          Your AI Meeting<br />
          <span className="text-blue-600">Scribe for Google Meet</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed">
          Deploy an intelligent bot to join your Google Meet, capture every word, and deliver a structured AI summary with decisions, action items, and more.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login">
            <Button size="lg" className="gap-2 px-8">
              <Video className="h-5 w-5" />
              Start Scribing for Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 border-t border-b border-gray-100 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-10">Everything you need</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 mb-3">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-gray-900 mb-10">How it works</h2>
        <div className="space-y-4">
          {HOW_IT_WORKS.map(({ step, text }) => (
            <div key={step} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold shrink-0">
                {step}
              </div>
              <span className="text-gray-700 font-medium">{text}</span>
              <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-14">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to never miss a meeting detail again?</h2>
          <p className="text-blue-200 mb-6">Sign up free and send your first bot in under a minute.</p>
          <Link href="/login">
            <Button size="lg" variant="outline" className="gap-2 bg-white text-blue-700 border-white hover:bg-blue-50">
              <Bot className="h-5 w-5" />
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span>MeetScribe</span>
          </div>
          <span>Built with Next.js · Gemini AI · Firebase · Puppeteer</span>
        </div>
      </footer>
    </div>
  );
}
