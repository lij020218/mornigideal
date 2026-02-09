import { NextResponse } from 'next/server';
import { initializeScheduler } from '@/lib/scheduler';

export async function GET() {
    // 프로덕션에서 디버그 엔드포인트 차단
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    try {
        initializeScheduler();
        return NextResponse.json({ message: 'Scheduler initialized' });
    } catch (error) {
        console.error('Error initializing scheduler:', error);
        return NextResponse.json({ error: 'Failed to initialize scheduler' }, { status: 500 });
    }
}
