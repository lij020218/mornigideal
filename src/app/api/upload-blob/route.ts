import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    console.log('[upload-blob] Session:', session?.user?.email);

    if (!session?.user?.email) {
      console.error('[upload-blob] Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename, contentType } = await request.json();

    if (!filename) {
      console.error('[upload-blob] No filename provided');
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    console.log('[upload-blob] Generating upload URL for:', filename);

    // Check if token exists
    const token = process.env.moringaidealblob_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error('[upload-blob] No blob token found in environment');
      return NextResponse.json({ error: 'Blob storage not configured' }, { status: 500 });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const uniqueFilename = `${timestamp}-${randomSuffix}-${filename}`;

    // Create a presigned upload URL
    const { url: uploadUrl } = await put(uniqueFilename, new Blob([]), {
      access: 'public',
      token: token,
      contentType: contentType || 'application/octet-stream',
    });

    // The final blob URL will be the same as upload URL
    const blobUrl = uploadUrl;

    console.log('[upload-blob] Upload URL generated');
    return NextResponse.json({ uploadUrl, blobUrl });
  } catch (error: any) {
    console.error('[upload-blob] Error:', error);
    console.error('[upload-blob] Error stack:', error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
