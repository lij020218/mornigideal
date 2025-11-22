import { NextResponse } from 'next/server';
import { initializeScheduler } from '@/lib/scheduler';

export async function GET() {
    try {
        initializeScheduler();
        return NextResponse.json({ message: 'Scheduler initialized' });
    } catch (error) {
        console.error('Error initializing scheduler:', error);
        return NextResponse.json({ error: 'Failed to initialize scheduler' }, { status: 500 });
    }
}
