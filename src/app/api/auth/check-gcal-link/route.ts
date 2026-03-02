/**
 * Google Calendar 연동 상태 확인 API
 *
 * GET: 연동 여부 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';

export const GET = withAuth(async (_request: NextRequest, email: string) => {
    const { data, error } = await supabaseAdmin
        .from('google_calendar_tokens')
        .select('calendar_id, expires_at')
        .eq('user_email', email)
        .maybeSingle();

    if (error || !data) {
        return NextResponse.json({ linked: false });
    }

    return NextResponse.json({
        linked: true,
        calendarId: data.calendar_id,
    });
});
