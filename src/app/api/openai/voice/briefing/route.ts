/**
 * 음성 브리핑 API
 * GET: 오늘의 브리핑을 TTS 오디오로 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { kvGet } from '@/lib/kv-store';
import { isProOrAbove } from '@/lib/user-plan';
import { MODELS } from '@/lib/models';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(request: NextRequest) {
    const email = await getUserEmailWithAuth(request);
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Plan gate: Pro+
    if (!(await isProOrAbove(email))) {
        return NextResponse.json(
            { error: '음성 브리핑은 Pro 이상 플랜에서 사용 가능합니다.' },
            { status: 403 },
        );
    }

    // Gather today's data
    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    const dayOfWeek = kst.getDay();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    // Get user profile & schedules
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('profile, name')
        .eq('email', email)
        .maybeSingle();

    if (!userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const profile = userData.profile || {};
    const userName = userData.name || profile.name || '';
    const customGoals = profile.customGoals || [];

    // Today's schedules
    const todaySchedules = customGoals
        .filter((g: any) =>
            g.specificDate === todayStr ||
            (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
        )
        .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));

    // Recent mood
    const monthKey = `mood_checkins_${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}`;
    const moodData = await kvGet<any[]>(email, monthKey);
    let moodSummary = '';
    if (Array.isArray(moodData) && moodData.length > 0) {
        const recent = moodData.filter((m: any) => m.date === todayStr);
        if (recent.length > 0) {
            const last = recent[recent.length - 1];
            const moodLabels: Record<number, string> = { 1: '매우 안 좋음', 2: '안 좋음', 3: '보통', 4: '좋음', 5: '매우 좋음' };
            moodSummary = `오늘 기분은 ${moodLabels[last.mood] || '보통'}이에요.`;
        }
    }

    // Build briefing text
    const month = kst.getMonth() + 1;
    const day = kst.getDate();
    let briefingText = `${userName ? userName + '님, ' : ''}좋은 아침이에요. ${month}월 ${day}일 ${dayNames[dayOfWeek]}요일 브리핑입니다.\n\n`;

    if (todaySchedules.length === 0) {
        briefingText += '오늘은 등록된 일정이 없어요. 여유로운 하루 보내세요.\n';
    } else {
        briefingText += `오늘은 총 ${todaySchedules.length}개의 일정이 있어요.\n`;
        for (const s of todaySchedules.slice(0, 5)) {
            const time = s.startTime || '시간 미정';
            briefingText += `${time}에 ${s.text}`;
            if (s.location) briefingText += `, 장소는 ${s.location}`;
            briefingText += '.\n';
        }
        if (todaySchedules.length > 5) {
            briefingText += `외 ${todaySchedules.length - 5}개의 일정이 더 있어요.\n`;
        }
    }

    if (moodSummary) {
        briefingText += `\n${moodSummary}\n`;
    }

    briefingText += '\n오늘도 좋은 하루 되세요!';

    // Generate TTS
    try {
        const ttsResponse = await openai.audio.speech.create({
            model: MODELS.GPT_4O_MINI_TTS,
            voice: 'coral',
            input: briefingText,
            response_format: 'mp3',
            instructions: '밝고 친근한 톤으로, 한국어 자연스럽게 읽어주세요.',
        });

        const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());

        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': String(audioBuffer.length),
                'X-Briefing-Text': encodeURIComponent(briefingText),
            },
        });
    } catch (error) {
        console.error('[VoiceBriefing] TTS error:', error);
        // Fallback: return text-only briefing
        return NextResponse.json({
            briefingText,
            audioAvailable: false,
        });
    }
}
