/**
 * 모닝 위젯 푸시 CRON
 * 매일 08:00 KST — 리치 모닝 요약 푸시 알림
 * "오늘 일정 5개 | 주간 목표 70% | 기분: 좋음"
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { kvGet } from '@/lib/kv-store';
import { sendBulkPushNotifications } from '@/lib/pushService';

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    const dayOfWeek = kst.getDay();
    const monthKey = `mood_checkins_${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}`;

    // Get all users with profiles
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('email, profile');

    if (!users || users.length === 0) {
        return NextResponse.json({ message: 'No users found', sent: 0 });
    }

    const notifications: Array<{
        userEmail: string;
        title: string;
        body: string;
        data?: Record<string, any>;
    }> = [];

    for (const user of users) {
        try {
            const profile = user.profile || {};
            const customGoals = profile.customGoals || [];

            // Count today's schedules
            const todaySchedules = customGoals.filter((g: any) =>
                g.specificDate === todayStr ||
                (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
            );
            const totalSchedules = todaySchedules.length;

            // Weekly goal progress
            const longTermGoals = profile.longTermGoals || {};
            const weeklyGoals = (longTermGoals.weekly || []) as any[];
            const activeWeekly = weeklyGoals.filter((g: any) => !g.completed);
            const avgProgress = activeWeekly.length > 0
                ? Math.round(activeWeekly.reduce((sum: number, g: any) => sum + (g.progress || 0), 0) / activeWeekly.length)
                : 0;

            // Recent mood
            const moodData = await kvGet<any[]>(user.email, monthKey);
            let moodText = '';
            if (Array.isArray(moodData) && moodData.length > 0) {
                const lastMood = moodData[moodData.length - 1];
                const moodEmojis: Record<number, string> = { 1: '😫', 2: '😔', 3: '😐', 4: '😊', 5: '😄' };
                moodText = ` | 기분: ${moodEmojis[lastMood.mood] || '😐'}`;
            }

            // Build push message
            const parts: string[] = [];
            if (totalSchedules > 0) {
                parts.push(`오늘 일정 ${totalSchedules}개`);
            } else {
                parts.push('오늘 일정 없음');
            }
            if (activeWeekly.length > 0) {
                parts.push(`주간 목표 ${avgProgress}%`);
            }

            const bodyText = parts.join(' | ') + moodText;

            // Greeting by day
            const greetings = ['좋은 아침이에요! ☀️', '오늘도 화이팅! 💪', '상쾌한 하루 시작! 🌅'];
            const greeting = greetings[dayOfWeek % greetings.length];

            notifications.push({
                userEmail: user.email,
                title: greeting,
                body: bodyText,
                data: { type: 'morning_summary', deepLink: 'fieri://dashboard' },
            });
        } catch (e) {
            console.error(`[MorningPush] Error for ${user.email}:`, e instanceof Error ? e.message : e);
        }
    }

    // Send via pushService (handles batching & token lookup internally)
    const result = notifications.length > 0
        ? await sendBulkPushNotifications(notifications)
        : { sent: 0, failed: 0 };

    return NextResponse.json({
        success: true,
        sent: result.sent,
        failed: result.failed,
        total: users.length,
        date: todayStr,
    });
}
