import puppeteer, { Browser, Page } from 'puppeteer';
import { Server as SocketServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { SOCKET_EVENTS, BotStatus, TranscriptLine } from '../socket/events';
import { injectCaptionObserver, enableCaptions } from './caption.service';
import { uploadTranscript } from './storage.service';

export interface BotSession {
  id: string;
  meetingId: string;
  status: BotStatus;
  browser: Browser | null;
  page: Page | null;
  transcriptLines: TranscriptLine[];
  startedAt: number | null;
  endedAt: number | null;
  meetingEndPoller: ReturnType<typeof setInterval> | null;
}

const sessions = new Map<string, BotSession>();

function wait(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Safe page.evaluate that handles detached frames
async function safeEval<T>(page: Page, fn: () => T): Promise<T | null> {
  try {
    if (page.isClosed()) return null;
    return await page.evaluate(fn);
  } catch {
    return null;
  }
}

function emitStatus(io: SocketServer, meetingId: string, status: BotStatus, message?: string) {
  const session = sessions.get(meetingId);
  if (session) session.status = status;
  io.to(meetingId).emit(SOCKET_EVENTS.BOT_STATUS, { meetingId, status, message });
  console.log(`[bot:${meetingId}] status → ${status}${message ? ': ' + message : ''}`);
}

export async function startBot(
  meetUrl: string,
  meetingId: string,
  io: SocketServer
): Promise<string> {
  if (sessions.has(meetingId)) {
    throw new Error(`Bot session already exists for meeting ${meetingId}`);
  }

  const session: BotSession = {
    id: uuidv4(),
    meetingId,
    status: 'idle',
    browser: null,
    page: null,
    transcriptLines: [],
    startedAt: null,
    endedAt: null,
    meetingEndPoller: null,
  };
  sessions.set(meetingId, session);

  runBot(session, meetUrl, io).catch((err) => {
    console.error(`[bot:${meetingId}] Fatal error:`, err);
    emitStatus(io, meetingId, 'error', err.message);
    cleanupSession(meetingId);
  });

  return session.id;
}

async function runBot(session: BotSession, meetUrl: string, io: SocketServer): Promise<void> {
  const { meetingId } = session;
  emitStatus(io, meetingId, 'joining', 'Launching browser...');

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  session.browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1280,720',
      '--js-flags=--max-old-space-size=256',
    ],
    defaultViewport: { width: 1280, height: 720 },
  });

  const context = session.browser.defaultBrowserContext();
  await context.overridePermissions('https://meet.google.com', ['camera', 'microphone', 'notifications']);

  session.page = await session.browser.newPage();
  const page = session.page;

  // Hide automation
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['font', 'media'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  // --- Navigate ---
  emitStatus(io, meetingId, 'joining', 'Navigating to Google Meet...');
  await page.goto(meetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await wait(3000);

  // --- Dismiss cookie banners ---
  await safeEval(page, () => {
    const selectors = ['[data-mdc-dialog-action="accept"]', '[aria-label="Accept all"]', 'button[jsname="higCR"]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) { el.click(); return; }
    }
  });
  await wait(1000);

  // --- Enter name ---
  emitStatus(io, meetingId, 'joining', 'Entering bot name...');
  const nameSelectors = [
    'input[placeholder="Your name"]',
    'input[aria-label="Your name"]',
    'input[jsname="YPqjbf"]',
  ];
  for (const sel of nameSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 6000 });
      await page.click(sel, { clickCount: 3 });
      await page.type(sel, 'MeetScribe Bot', { delay: 50 });
      break;
    } catch { /* try next */ }
  }

  await wait(500);

  // --- Click Join ---
  emitStatus(io, meetingId, 'waiting', 'Requesting to join meeting...');

  // Try specific selectors first
  let joined = false;
  const joinSelectors = ['button[jsname="Qx7uuf"]', '[data-idom-class*="AjY5Ib"]'];
  for (const sel of joinSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); joined = true; break; }
    } catch { /* try next */ }
  }

  // Fallback: find any button with Join text
  if (!joined) {
    joined = await safeEval(page, () => {
      const buttons = [...document.querySelectorAll('button')];
      const btn = buttons.find(b =>
        b.innerText.includes('Join now') ||
        b.innerText.includes('Ask to join') ||
        b.innerText.includes('Join')
      );
      if (btn) { btn.click(); return true; }
      return false;
    }) ?? false;
  }

  if (!joined) throw new Error('Could not find Join button on Google Meet page');

  // --- Wait for page navigation after joining ---
  // Google Meet navigates to a new URL/frame when entering the meeting room
  await wait(3000);
  try {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
  } catch {
    // Navigation may not happen if already on the right page — that's fine
  }
  await wait(2000);

  // --- Wait to be admitted ---
  emitStatus(io, meetingId, 'waiting', 'Waiting to be admitted...');

  let admitted = false;
  for (let i = 0; i < 30; i++) {
    await wait(2000);
    if (page.isClosed()) break;

    admitted = await safeEval(page, () => {
      const selectors = [
        '[data-allocation-index]',
        '[aria-label="Chat with everyone"]',
        '[jsname="A5il2e"]',
        '.crqnQb',
      ];
      return selectors.some(sel => !!document.querySelector(sel));
    }) ?? false;

    if (admitted) break;

    const denied = await safeEval(page, () =>
      document.body?.innerText?.includes("wasn't let in") ||
      document.body?.innerText?.includes('denied') ||
      false
    );
    if (denied) throw new Error('Bot was denied entry to the meeting');
  }

  if (!admitted) throw new Error('Timed out waiting to be admitted to the meeting');

  session.startedAt = Date.now();
  emitStatus(io, meetingId, 'live', 'Bot is live in the meeting');

  // --- Enable Captions ---
  await wait(3000);
  await enableCaptions(page).catch(() => {});

  // --- Inject Caption Observer ---
  try {
    await page.exposeFunction('onCaptionLine', (text: string, speaker: string) => {
      const line: TranscriptLine = { meetingId, line: text, speakerLabel: speaker, timestamp: Date.now() };
      session.transcriptLines.push(line);
      io.to(meetingId).emit(SOCKET_EVENTS.TRANSCRIPT_UPDATE, line);
    });
    await injectCaptionObserver(page);
  } catch (err) {
    console.warn(`[bot:${meetingId}] Caption injection warning:`, err);
  }

  // --- Poll for Meeting End ---
  session.meetingEndPoller = setInterval(async () => {
    if (!session.page || session.page.isClosed()) {
      clearInterval(session.meetingEndPoller!);
      await handleMeetingEnd(session, io);
      return;
    }
    try {
      const ended = await safeEval(page, () => {
        const t = document.body?.innerText || '';
        return t.includes('You left the meeting') ||
          t.includes('The meeting has ended') ||
          t.includes('Meeting ended') ||
          t.includes('Return to home screen');
      });
      if (ended) {
        clearInterval(session.meetingEndPoller!);
        await handleMeetingEnd(session, io);
      }
    } catch {
      clearInterval(session.meetingEndPoller!);
      await handleMeetingEnd(session, io);
    }
  }, 8000);
}

async function handleMeetingEnd(session: BotSession, io: SocketServer): Promise<void> {
  const { meetingId } = session;
  session.endedAt = Date.now();

  emitStatus(io, meetingId, 'processing', 'Meeting ended — uploading transcript...');

  const duration = session.startedAt
    ? Math.round((session.endedAt - session.startedAt) / 1000)
    : 0;

  let transcriptUrl: string | null = null;
  if (session.transcriptLines.length > 0) {
    transcriptUrl = await uploadTranscript(meetingId, session.transcriptLines).catch(() => null);
  }

  const webAppUrl = process.env.WEB_APP_URL;
  if (webAppUrl && session.transcriptLines.length > 0) {
    try {
      await fetch(`${webAppUrl}/api/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': process.env.BOT_SERVICE_SECRET || '',
        },
        body: JSON.stringify({ meetingId, transcript: session.transcriptLines, transcriptUrl }),
      });
    } catch (err) {
      console.error(`[bot:${meetingId}] Failed to trigger summarization:`, err);
    }
  }

  io.to(meetingId).emit(SOCKET_EVENTS.MEETING_ENDED, {
    meetingId,
    totalLines: session.transcriptLines.length,
    duration,
    transcriptUrl,
  });

  emitStatus(io, meetingId, 'done');
  await cleanupSession(meetingId);
}

export async function stopBot(meetingId: string, io: SocketServer): Promise<void> {
  const session = sessions.get(meetingId);
  if (!session) throw new Error(`No active bot session for meeting ${meetingId}`);
  if (session.meetingEndPoller) clearInterval(session.meetingEndPoller);
  await handleMeetingEnd(session, io);
}

export function getBotStatus(meetingId: string): BotStatus | null {
  return sessions.get(meetingId)?.status ?? null;
}

export function getBotCaptionCount(meetingId: string): number {
  return sessions.get(meetingId)?.transcriptLines.length ?? 0;
}

async function cleanupSession(meetingId: string): Promise<void> {
  const session = sessions.get(meetingId);
  if (!session) return;
  try {
    if (session.page && !session.page.isClosed()) await session.page.close();
    if (session.browser) await session.browser.close();
  } catch { /* ignore cleanup errors */ }
  sessions.delete(meetingId);
  console.log(`[bot:${meetingId}] Session cleaned up`);
}
