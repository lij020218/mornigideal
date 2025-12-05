import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
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
        // Check authentication before generating token
        const session = await auth();
        console.log('[upload-blob] Session:', session?.user?.email);

        if (!session?.user?.email) {
          console.error('[upload-blob] Unauthorized - no session');
          throw new Error('Unauthorized');
        }

        // Generate a unique filename with timestamp
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const newPathname = `${timestamp}-${randomSuffix}-${pathname}`;

        console.log('[upload-blob] Generating token for:', newPathname);

        return {
          allowedContentTypes: [
            'text/plain',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          tokenPayload: JSON.stringify({
            userEmail: session.user.email,
          }),
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
    console.error('[upload-blob] Error stack:', error.stack);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
