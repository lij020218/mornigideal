/**
 * 사용자 피드백 API
 *
 * POST: 피드백 제출 (버그, 기능 개선, 알림 문제 등)
 * - 자동 컨텍스트 수집 (디바이스, OS, 앱 버전)
 * - 스크린샷 첨부 (Supabase Storage)
 * - 관리자 push 알림
 * - 하루 5건 제한
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';
import { userFeedbackSchema, validateBody } from '@/lib/schemas';
import { sendPushNotification } from '@/lib/pushService';
import { logger } from '@/lib/logger';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

const CATEGORY_LABELS: Record<string, string> = {
    bug: '버그/오류',
    feature_request: '기능 개선',
    notification: '알림 문제',
    schedule: '일정 관련',
    ai_quality: 'AI 응답 품질',
    other: '기타',
};

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const body = await request.json();
    const v = validateBody(userFeedbackSchema, body);
    if (!v.success) return v.response;

    const { category, severity, title, description, context, screenshotBase64 } = v.data;

    // 하루 5건 제한
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const { count: todayCount } = await supabaseAdmin
        .from('user_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('user_email', email)
        .gte('created_at', `${today}T00:00:00+09:00`);

    if ((todayCount || 0) >= 5) {
        return NextResponse.json(
            { error: '하루 최대 5건까지 피드백을 보낼 수 있습니다' },
            { status: 429 },
        );
    }

    // 스크린샷 업로드
    const screenshotUrls: string[] = [];
    if (screenshotBase64) {
        try {
            const buffer = Buffer.from(screenshotBase64, 'base64');
            const feedbackId = crypto.randomUUID();
            const path = `feedback/${email}/${feedbackId}.jpg`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from('feedback-screenshots')
                .upload(path, buffer, {
                    contentType: 'image/jpeg',
                    upsert: false,
                });

            if (!uploadError) {
                screenshotUrls.push(path);
            } else {
                logger.error('[Feedback] Screenshot upload failed:', uploadError.message);
            }
        } catch (err) {
            logger.error('[Feedback] Screenshot processing error:', err);
        }
    }

    // DB 저장
    const { data: feedback, error: insertError } = await supabaseAdmin
        .from('user_feedback')
        .insert({
            user_email: email,
            category,
            severity,
            title,
            description,
            context: context || {},
            screenshot_urls: screenshotUrls,
        })
        .select('id')
        .single();

    if (insertError) {
        logger.error('[Feedback] Insert failed:', insertError);
        return NextResponse.json({ error: '피드백 저장에 실패했습니다' }, { status: 500 });
    }

    // 관리자 push 알림
    for (const adminEmail of ADMIN_EMAILS) {
        sendPushNotification(adminEmail, {
            title: `새 피드백: ${CATEGORY_LABELS[category] || category}`,
            body: title,
            data: { type: 'admin_feedback', feedbackId: feedback.id },
        }).catch(() => {});
    }

    return NextResponse.json({ success: true, feedbackId: feedback.id });
});
