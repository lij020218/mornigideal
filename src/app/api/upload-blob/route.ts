import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Authenticate upfront before processing the upload
  const userEmail = await getUserEmailWithAuth(request);
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    // Check if token exists
    const token = process.env.moringaidealblob_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error('[upload-blob] No blob token found in environment');
      return NextResponse.json({ error: 'Blob storage not configured' }, { status: 500 });
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Keep original filename to allow reuse of existing files (cost savings)

        return {
          allowedContentTypes: [
            'text/plain',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          tokenPayload: JSON.stringify({
            userEmail: userEmail,
          }),
          // Allow overwriting existing files to reuse them
          allowOverwrite: true,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[upload-blob] Upload completed:', blob.url);
      },
      token,
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error('[upload-blob] Error:', error);
    return NextResponse.json({ error: "Upload failed" }, { status: 400 });
  }
}
