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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('[upload-blob] No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('[upload-blob] File:', file.name, file.size, 'bytes');

    // Check if token exists
    const token = process.env.moringaidealblob_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error('[upload-blob] No blob token found in environment');
      return NextResponse.json({ error: 'Blob storage not configured' }, { status: 500 });
    }

    console.log('[upload-blob] Token exists:', !!token);

    // Upload to Vercel Blob with custom token
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
      token: token,
    });

    console.log('[upload-blob] Upload success:', blob.url);
    return NextResponse.json({ blobUrl: blob.url });
  } catch (error: any) {
    console.error('[upload-blob] Error:', error);
    console.error('[upload-blob] Error stack:', error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
