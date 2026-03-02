/**
 * Gmail 연동 해제 API
 *
 * DELETE: gmail_tokens + email_tokens(gmail) 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';

export const DELETE = withAuth(async (_request: NextRequest, email: string) => {
    // gmail_tokens 삭제
    const { error: err1 } = await supabaseAdmin
        .from('gmail_tokens')
        .delete()
        .eq('user_email', email);

    if (err1) logger.error('[Unlink Gmail] gmail_tokens 삭제 실패:', err1);

    // email_tokens 삭제 (범용 테이블)
    const { error: err2 } = await supabaseAdmin
        .from('email_tokens')
        .delete()
        .eq('user_email', email)
        .eq('provider', 'gmail');

    if (err2) logger.error('[Unlink Gmail] email_tokens 삭제 실패:', err2);

    logger.info(`[Unlink Gmail] 연동 해제 완료: ${email}`);

    return NextResponse.json({ success: true });
});
