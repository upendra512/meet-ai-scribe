import { GoogleGenerativeAI } from '@google/generative-ai';
import { MeetingSummary, TranscriptLine } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function buildTranscriptText(lines: TranscriptLine[]): string {
  return lines
    .map(l => `[${l.speakerLabel}] ${l.line}`)
    .join('\n');
}

export async function summarizeMeeting(lines: TranscriptLine[]): Promise<MeetingSummary> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });

  const transcriptText = buildTranscriptText(lines);

  const prompt = `You are a professional meeting summarizer. Analyze this Google Meet transcript and return ONLY valid JSON.

TRANSCRIPT:
${transcriptText}

Return this exact JSON structure (no markdown, no explanation):
{
  "title": "Brief 5-7 word meeting title",
  "overview": "2-3 sentence paragraph summarizing the purpose and outcome",
  "keyDecisions": ["Decision made", "Another decision"],
  "actionItems": [
    { "item": "Task description", "owner": "Person name or Team", "deadline": null }
  ],
  "participants": ["Name1", "Name2"],
  "topics": ["Topic 1", "Topic 2", "Topic 3"]
}

Rules:
- keyDecisions: only firm decisions made, not discussions. Max 5 items.
- actionItems: only concrete next steps with a clear owner. Max 8 items.
- participants: names from the transcript speaker labels (not "Unknown").
- Do not invent facts. If something is unclear, omit it.
- If transcript is empty or too short, still return valid JSON with empty arrays.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as MeetingSummary;
    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[gemini] Failed to parse JSON response, using fallback:', err);

    // Fallback: plain text summary
    const fallbackModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    });

    const fallback = await fallbackModel.generateContent(
      `Summarize this meeting transcript in 2-3 sentences:\n\n${transcriptText}`
    );

    return {
      title: 'Meeting Summary',
      overview: fallback.response.text(),
      keyDecisions: [],
      actionItems: [],
      participants: [],
      topics: [],
      generatedAt: new Date().toISOString(),
    };
  }
}
