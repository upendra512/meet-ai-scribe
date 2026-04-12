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

// Map of meetingId → BotSession
const sessions = new Map<string, BotSession>();

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

  // Run bot asynchronously so we return the botId immediately
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

  // --- Launch Browser ---
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  session.browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1280,720',
    ],
    defaultViewport: { width: 1280, height: 720 },
  });

  const context = session.browser.defaultBrowserContext();

  // Grant media permissions for Google Meet domain
  await context.overridePermissions('https://meet.google.com', [
    'camera',
    'microphone',
    'notifications',
  ]);

  session.page = await session.browser.newPage();
  const page = session.page;

  // Hide automation fingerprints
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // @ts-ignore
    delete navigator.__proto__.webdriver;
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  // Block unnecessary resources to speed up loading
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const blocked = ['font', 'media'];
    if (blocked.includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  // --- Navigate to Meet ---
  emitStatus(io, meetingId, 'joining', 'Navigating to Google Meet...');
  await page.goto(meetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Dismiss any cookie/consent banners
  await page.evaluate(() => {
    const selectors = [
      '[data-mdc-dialog-action="accept"]',
      '[aria-label="Accept all"]',
      'button[jsname="higCR"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) { el.click(); return; }
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  // --- Handle Name Input (guest join) ---
  emitStatus(io, meetingId, 'joining', 'Entering bot name...');

  const nameInputSelectors = [
    'input[placeholder="Your name"]',
    'input[aria-label="Your name"]',
    'input[jsname="YPqjbf"]',
    '#c13 input',
  ];

  let nameInputFound = false;
  for (const sel of nameInputSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 8000 });
      await page.click(sel, { clickCount: 3 });
      await page.type(sel, 'MeetScribe Bot', { delay: 60 });
      nameInputFound = true;
      break;
    } catch {
      // Try next selector
    }
  }

  if (!nameInputFound) {
    console.warn(`[bot:${meetingId}] Could not find name input — user may already be signed in`);
  }

  // --- Mute mic + camera before joining ---
  await page.evaluate(() => {
    // Try to click mute buttons if they exist in the pre-join screen
    const selectors = [
      '[data-is-muted="false"][aria-label*="microphone"]',
      '[data-is-muted="false"][aria-label*="camera"]',
      '[data-promo-anchor-id="mute-audio"]',
      '[data-promo-anchor-id="mute-video"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) el.click();
    }
  });

  await new Promise(r => setTimeout(r, 500));

  // --- Click Join Button ---
  emitStatus(io, meetingId, 'waiting', 'Requesting to join meeting...');

  const joinButtonSelectors = [
    '[data-idom-class="nCP5yc AjY5Ib YxyAuT"]',
    'button[jsname="Qx7uuf"]',
    'button[data-idom-class*="AjY5Ib"]',
  ];

  let joined = false;
  for (const sel of joinButtonSelectors) {
    const btn = await page.$(sel);
    if (btn) {
      await btn.click();
      joined = true;
      break;
    }
  }

  if (!joined) {
    // Generic fallback: find button with "Join" text
    joined = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const joinBtn = buttons.find(
        b => b.innerText.includes('Join now') || b.innerText.includes('Ask to join') || b.innerText.includes('Join')
      );
      if (joinBtn) { joinBtn.click(); return true; }
      return false;
    });
  }

  if (!joined) {
    throw new Error('Could not find the Join button on the Google Meet page');
  }

  // --- Wait to be admitted ---
  emitStatus(io, meetingId, 'waiting', 'Waiting to be admitted...');

  // Poll for signs we are inside the meeting (video tiles, chat button, etc.)
  const admittedSelectors = [
    '[data-allocation-index]',  // participant tiles
    '[aria-label="Chat with everyone"]',
    '[jsname="A5il2e"]',        // meeting controls bar
    '.crqnQb',                  // meeting room container
  ];

  let admitted = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(r => setTimeout(r, 2000));

    admitted = await page.evaluate((selectors: string[]) => {
      return selectors.some(sel => document.querySelector(sel) !== null);
    }, admittedSelectors);

    if (admitted) break;

    // Check for "denied" / "removed" state
    const denied = await page.evaluate(() => {
      return document.body.innerText.includes("wasn't let in") ||
        document.body.innerText.includes('removed') ||
        document.body.innerText.includes('denied');
    });

    if (denied) {
      throw new Error('Bot was denied entry to the meeting');
    }
  }

  if (!admitted) {
    throw new Error('Timed out waiting to be admitted to the meeting');
  }

  session.startedAt = Date.now();
  emitStatus(io, meetingId, 'live', 'Bot is live in the meeting');

  // --- Enable Captions ---
  await new Promise(r => setTimeout(r, 3000));
  await enableCaptions(page);

  // --- Inject Caption Observer ---
  await page.exposeFunction('onCaptionLine', (text: string, speaker: string) => {
    const line: TranscriptLine = {
      meetingId,
      line: text,
      speakerLabel: speaker,
      timestamp: Date.now(),
    };
    session.transcriptLines.push(line);
    io.to(meetingId).emit(SOCKET_EVENTS.TRANSCRIPT_UPDATE, line);
  });

  await injectCaptionObserver(page);

  // --- Poll for Meeting End ---
  session.meetingEndPoller = setInterval(async () => {
    if (!session.page || session.page.isClosed()) {
      clearInterval(session.meetingEndPoller!);
      await handleMeetingEnd(session, io);
      return;
    }

    try {
      const ended = await page.evaluate(() => {
        const bodyText = document.body?.innerText || '';
        return (
          bodyText.includes('You left the meeting') ||
          bodyText.includes('The meeting has ended') ||
          bodyText.includes('Meeting ended') ||
          bodyText.includes('Return to home screen') ||
          document.title.toLowerCase().includes('left')
        );
      });

      if (ended) {
        clearInterval(session.meetingEndPoller!);
        await handleMeetingEnd(session, io);
      }
    } catch {
      // Page may have been closed
      clearInterval(session.meetingEndPoller!);
      await handleMeetingEnd(session, io);
    }
  }, 8000);
}

async function handleMeetingEnd(session: BotSession, io: SocketServer): Promise<void> {
  const { meetingId } = session;
  session.endedAt = Date.now();
  session.status = 'processing';

  emitStatus(io, meetingId, 'processing', 'Meeting ended — uploading transcript...');

  const duration = session.startedAt
    ? Math.round((session.endedAt - session.startedAt) / 1000)
    : 0;

  // Upload transcript to GCP Storage
  let transcriptUrl: string | null = null;
  if (session.transcriptLines.length > 0) {
    transcriptUrl = await uploadTranscript(meetingId, session.transcriptLines);
  }

  // Notify the Next.js web app to trigger summarization
  const webAppUrl = process.env.WEB_APP_URL;
  if (webAppUrl && session.transcriptLines.length > 0) {
    try {
      await fetch(`${webAppUrl}/api/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': process.env.BOT_SERVICE_SECRET || '',
        },
        body: JSON.stringify({
          meetingId,
          transcript: session.transcriptLines,
          transcriptUrl,
        }),
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

  emitStatus(io, meetingId, 'done', 'Summary generation complete');
  await cleanupSession(meetingId);
}

export async function stopBot(meetingId: string, io: SocketServer): Promise<void> {
  const session = sessions.get(meetingId);
  if (!session) throw new Error(`No active bot session for meeting ${meetingId}`);

  if (session.meetingEndPoller) {
    clearInterval(session.meetingEndPoller);
  }

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
    if (session.page && !session.page.isClosed()) {
      await session.page.close();
    }
    if (session.browser) {
      await session.browser.close();
    }
  } catch (err) {
    console.error(`[bot:${meetingId}] Cleanup error:`, err);
  }

  sessions.delete(meetingId);
  console.log(`[bot:${meetingId}] Session cleaned up`);
}
