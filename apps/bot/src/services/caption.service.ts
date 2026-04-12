import type { Page } from 'puppeteer';

/**
 * Injects a MutationObserver into the Google Meet page to scrape live captions.
 * Calls window.onCaptionLine(text, speaker) whenever a new caption line is complete.
 */
export async function injectCaptionObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Google Meet caption DOM selectors (multi-fallback for resilience)
    // The caption container holds the currently spoken text
    const CAPTION_CONTAINER_SELECTORS = [
      '.a4cQT',
      '[jsname="tgaKEf"]',
      '[jsname="YSxPC"]',
      '.CNusmb',
      '[class*="captionsText"]',
      '[class*="caption-text"]',
    ];

    // Speaker name selectors
    const SPEAKER_SELECTORS = [
      '.zs7s8d',
      '.KcIKyf',
      '[jsname="bVB"]',
      '[data-participant-id]',
      '[class*="speakerName"]',
    ];

    let lastEmittedText = '';
    let lastSpeaker = 'Unknown';
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function findCaptionContainer(): Element | null {
      for (const sel of CAPTION_CONTAINER_SELECTORS) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    }

    function findSpeakerName(): string {
      for (const sel of SPEAKER_SELECTORS) {
        const el = document.querySelector(sel);
        if (el && el.textContent?.trim()) {
          return el.textContent.trim();
        }
      }
      return lastSpeaker;
    }

    function extractCaptionText(container: Element): string {
      // Try to get all text from the caption block
      const textNodes: string[] = [];
      container.querySelectorAll('span').forEach((span) => {
        const t = span.textContent?.trim();
        if (t) textNodes.push(t);
      });
      if (textNodes.length > 0) return textNodes.join(' ');
      return container.textContent?.trim() || '';
    }

    function maybeEmit() {
      const container = findCaptionContainer();
      if (!container) return;

      const text = extractCaptionText(container);
      const speaker = findSpeakerName();

      if (!text || text === lastEmittedText) return;

      // Emit when:
      // 1. Text ends with sentence-ending punctuation
      // 2. Text changed significantly (new speaker started, or big addition)
      const endsWithPunctuation = /[.?!,;]$/.test(text);
      const significantChange = text.length > lastEmittedText.length + 15;

      if (endsWithPunctuation || significantChange) {
        lastEmittedText = text;
        lastSpeaker = speaker;
        // @ts-ignore - injected by page.exposeFunction
        window.onCaptionLine(text, speaker);
      }
    }

    // MutationObserver watches the entire body for caption DOM mutations
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(maybeEmit, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Also poll every 2 seconds as a safety net
    setInterval(maybeEmit, 2000);

    // @ts-ignore - store for cleanup
    window._meetScribeCaptionObserver = observer;
  });
}

/**
 * Attempt to enable captions in Google Meet.
 * Tries keyboard shortcut first, then UI button fallback.
 */
export async function enableCaptions(page: Page): Promise<void> {
  // Method 1: Keyboard shortcut 'c'
  await page.keyboard.press('c');
  await new Promise(r => setTimeout(r, 1500));

  // Check if captions are now visible
  const captionsVisible = await page.evaluate(() => {
    const selectors = ['.a4cQT', '[jsname="tgaKEf"]', '[jsname="YSxPC"]', '.CNusmb'];
    return selectors.some(sel => document.querySelector(sel) !== null);
  });

  if (captionsVisible) return;

  // Method 2: Find "Turn on captions" in the More Options menu
  try {
    // Click the three-dots menu
    const moreOptionsSelectors = [
      '[data-tooltip="More options"]',
      '[aria-label="More options"]',
      '[jsname="NakZHc"]',
    ];

    for (const sel of moreOptionsSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await new Promise(r => setTimeout(r, 800));
        break;
      }
    }

    // Look for captions menu item
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('[role="menuitem"], [role="option"]')];
      const captionItem = items.find(
        i => i.textContent?.toLowerCase().includes('caption') || i.textContent?.toLowerCase().includes('subtitle')
      );
      if (captionItem) (captionItem as HTMLElement).click();
    });
  } catch {
    // Captions may not be available as a non-Workspace user — continue anyway
  }
}
