/**
 * 학습 콘텐츠 목록 API
 *
 * GET: 사용자의 학습 커리큘럼 및 콘텐츠 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';

export const GET = withAuth(async (_request: NextRequest, userEmail: string) => {
    // 사용자 프로필에서 학습 커리큘럼 조회
    const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('profile')
        .eq('email', userEmail)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ contents: [] });
    }

    const profile = user?.profile || {};
    const learningCurriculums = profile.learningCurriculums || [];
    const learningProgress = profile.learningProgress || {};

    // 커리큘럼을 콘텐츠 형식으로 변환
    const contents = learningCurriculums.map((curriculum: any) => ({
        id: curriculum.id,
        title: curriculum.title,
        subtitle: curriculum.subtitle || '',
        totalDays: curriculum.totalDays || 30,
        currentDay: learningProgress[curriculum.id]?.currentDay || 1,
        progress: learningProgress[curriculum.id]?.progress || 0,
        category: curriculum.category || 'general',
        createdAt: curriculum.createdAt,
    }));

    return NextResponse.json({ contents });
});
