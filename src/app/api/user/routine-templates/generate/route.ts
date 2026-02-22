/**
 * AI 맞춤 루틴 생성 API (Pro+ 전용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isProOrAbove } from '@/lib/user-plan';
import { templateGenerateSchema, validateBody } from '@/lib/schemas';
import { MODELS } from '@/lib/models';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
    const email = await getUserEmailWithAuth(request);
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Plan gate
    if (!(await isProOrAbove(email))) {
        return NextResponse.json(
            { error: 'AI 맞춤 루틴 생성은 Pro 이상 플랜에서 사용 가능합니다.' },
            { status: 403 },
        );
    }

    const body = await request.json();
    const v = validateBody(templateGenerateSchema, body);
    if (!v.success) return v.response;
    const { preferences } = v.data;

    // Get user profile for context
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('profile')
        .eq('email', email)
        .maybeSingle();

    const profile = userData?.profile || {};

    const prompt = `사용자 맞춤 일일 루틴을 생성해주세요.

사용자 정보:
- 기상: ${preferences.wakeUpTime || '미정'}
- 취침: ${preferences.sleepTime || '미정'}
- 근무시간: ${preferences.workHours || '미정'}
- 우선순위: ${preferences.priorities?.join(', ') || '없음'}
- 라이프스타일: ${preferences.lifestyle || '없음'}
- 직업/분야: ${profile.field || '미정'}
- 목표: ${profile.goal || '미정'}

다음 JSON 형식으로 6-10개의 일정을 생성하세요:
{
  "nameKo": "루틴 이름",
  "description": "한 줄 설명",
  "schedules": [
    { "text": "활동명", "startTime": "HH:MM", "endTime": "HH:MM", "color": "#hex" }
  ]
}

규칙:
- 시간은 HH:MM 24시간 형식
- 색상: 운동=#EF4444, 식사=#F59E0B, 업무=#8B5CF6, 학습=#EC4899, 건강=#10B981, 기타=#3B82F6
- 한국어로 작성
- JSON만 출력`;

    const completion = await openai.chat.completions.create({
        model: MODELS.GPT_5_MINI,
        messages: [{ role: 'user', content: prompt }],
        temperature: 1,
        response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';

    try {
        const generated = JSON.parse(content);
        return NextResponse.json({
            success: true,
            template: {
                id: `ai_${Date.now()}`,
                nameKo: generated.nameKo || 'AI 맞춤 루틴',
                description: generated.description || '',
                category: 'general' as const,
                schedules: generated.schedules || [],
                tags: ['AI 생성', '맞춤'],
            },
        });
    } catch {
        return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
    }
}
