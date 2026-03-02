/**
 * Google Calendar 연동 해제 API
 *
 * DELETE: google_calendar_tokens + calendar_tokens 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';

export const DELETE = withAuth(async (_request: NextRequest, email: string) => {
    // google_calendar_tokens 삭제
    const { error: err1 } = await supabaseAdmin
        .from('google_calendar_tokens')
        .delete()
        .eq('user_email', email);

    if (err1) logger.error('[Unlink GCal] google_calendar_tokens 삭제 실패:', err1);

    // calendar_tokens 삭제 (범용 테이블)
    const { error: err2 } = await supabaseAdmin
        .from('calendar_tokens')
        .delete()
        .eq('user_email', email)
        .eq('provider', 'google');

    if (err2) logger.error('[Unlink GCal] calendar_tokens 삭제 실패:', err2);

    // calendar_sync_mapping 삭제
    const { error: err3 } = await supabaseAdmin
        .from('calendar_sync_mapping')
        .delete()
        .eq('user_email', email);

    if (err3) logger.error('[Unlink GCal] calendar_sync_mapping 삭제 실패:', err3);

    logger.info(`[Unlink GCal] 연동 해제 완료: ${email}`);

    return NextResponse.json({ success: true });
});
