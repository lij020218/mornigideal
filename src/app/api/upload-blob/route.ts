import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request: NextRequest, email: string) => {
  const body = (await request.json()) as HandleUploadBody;

  // Check if token exists
  const token = process.env.moringaidealblob_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    logger.error('[upload-blob] No blob token found in environment');
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
          userEmail: email,
        }),
        // Allow overwriting existing files to reuse them
        allowOverwrite: true,
      };
    },
    onUploadCompleted: async ({ blob }) => {
    },
    token,
  });

  return NextResponse.json(jsonResponse);
});
