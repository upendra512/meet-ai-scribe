import { Storage } from '@google-cloud/storage';
import { TranscriptLine } from '../socket/events';

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const BUCKET_NAME = process.env.GCP_BUCKET_NAME || 'meet-scribe-transcripts';

export async function uploadTranscript(
  meetingId: string,
  lines: TranscriptLine[]
): Promise<string | null> {
  if (!process.env.GCP_PROJECT_ID) {
    console.warn('[storage] GCP_PROJECT_ID not set, skipping transcript upload');
    return null;
  }

  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const fileName = `transcripts/${meetingId}/transcript.json`;
    const file = bucket.file(fileName);

    const content = JSON.stringify(
      {
        meetingId,
        exportedAt: new Date().toISOString(),
        lines,
      },
      null,
      2
    );

    await file.save(content, {
      metadata: { contentType: 'application/json' },
    });

    // Make publicly readable
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;
    console.log(`[storage] Transcript uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error('[storage] Upload failed:', err);
    return null;
  }
}
