import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({ blobUrl: blob.url });
  } catch (error: any) {
    console.error('Blob upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
