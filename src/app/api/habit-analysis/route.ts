import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';
import { generateHabitInsights } from '@/lib/capabilities/habit-insights';

export const revalidate = 21600; // Cache for 6 hours

export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await generateHabitInsights(email, {});

        if (!result.success && !result.data) {
            return NextResponse.json({
                insight: '분석 준비 중',
                suggestion: '잠시 후 다시 확인해주세요',
                emoji: '⏳',
                category: 'consistency'
            });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error('[Habit Analysis API] Error:', error);
        return NextResponse.json({
            insight: '분석 준비 중',
            suggestion: '잠시 후 다시 확인해주세요',
            emoji: '⏳',
            category: 'consistency'
        });
    }
}
