/**
 * 오전 9시 동기부여 크론
 *
 * 매일 00:00 UTC (= 09:00 KST) 실행
 * 오늘 일정이 하나도 없는 사용자에게 목표 기반 동기부여 메시지 전송
 *
 * 채널: jarvis_notifications + chat_history + push
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendPushNotification } from '@/lib/pushService';
import { saveProactiveNotification } from '@/lib/proactiveNotificationService';
import { kvGet } from '@/lib/kv-store';
import { withCron } from '@/lib/api-handler';
import { withCronLogging } from '@/lib/cron-logger';
import { logger } from '@/lib/logger';
import { MODELS } from '@/lib/models';
import type { CustomGoal } from '@/lib/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const maxDuration = 120;

/** 오늘 일정이 있는지 체크 */
function hasTodaySchedules(
    customGoals: CustomGoal[],
    todayStr: string,
    dayOfWeek: number,
): boolean {
    return customGoals.some(goal => {
        if (goal.specificDate === todayStr) return true;
        if (goal.daysOfWeek?.includes(dayOfWeek) && !goal.specificDate) {
            if (goal.startDate && todayStr < goal.startDate) return false;
            if (goal.endDate && todayStr > goal.endDate) return false;
            return true;
        }
        return false;
    });
}

/** 목표 정보 추출 */
function extractGoals(profile: any): string {
    const ltg = profile?.longTermGoals;
    if (!ltg) return '';

    const goals: string[] = [];
    for (const type of ['weekly', 'monthly', 'yearly'] as const) {
        const items = ltg[type] || [];
        for (const g of items) {
            if (!g.completed) goals.push(`${g.title} (${g.progress || 0}%)`);
        }
    }
    return goals.length > 0 ? goals.slice(0, 3).join(', ') : '';
}

/** AI 동기부여 메시지 생성 */
async function generateMotivation(
    profile: any,
): Promise<{ message: string; suggestion: string } | null> {
    const name = profile?.name || '';
    const job = profile?.onboarding?.userType === '대학생'
        ? `${profile?.onboarding?.major || ''} 대학생`
        : profile?.onboarding?.field || profile?.job || '직장인';
    const interests = (profile?.onboarding?.interests || []).join(', ');
    const goals = extractGoals(profile);

    try {
        const completion = await openai.chat.completions.create({
            model: MODELS.GPT_5_MINI,
            messages: [{
                role: 'system',
                content: `사용자: ${job}, 관심사: ${interests || '없음'}, 목표: ${goals || '없음'}.
오늘 일정이 하나도 없다. 목표 달성을 위해 일정을 등록해야 한다고 동기부여하는 짧은 메시지를 작성하라.
톤: 따뜻하지만 단호하게. 목표가 있으면 목표를 언급하며 자극. 구체적 일정 1개 제안 포함.
JSON만: {"m":"동기부여 메시지 (2-3문장)","s":"추천 일정 (예: 오후 2시 독서 30분)"}`,
            }],
            temperature: 1.0,
            response_format: { type: 'json_object' },
        });

        const text = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(text);
        const msg = parsed.m || parsed.message;
        const sug = parsed.s || parsed.suggestion;
        if (!msg) return null;

        // 이름 개인화
        const personalized = name
            ? `${name}님, ${msg}`
            : msg;

        return { message: personalized, suggestion: sug || '' };
    } catch (error) {
        logger.error('[MorningMotivation] AI generation failed:', error);
        return null;
    }
}

export const GET = withCron(withCronLogging('morning-motivation', async (_request: NextRequest) => {
    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    const dayOfWeek = kst.getDay();

    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, email, profile');

    if (!users || users.length === 0) {
        return NextResponse.json({ message: 'No users', processed: 0 });
    }

    let sent = 0;
    let skipped = 0;

    // Phase 1: 대상 필터링 (오늘 일정 0개 + 오늘 미전송)
    type Target = { id: string; email: string; profile: any };
    const targets: Target[] = [];

    for (const user of users) {
        try {
            // 중복 방지
            const alreadySent = await kvGet<boolean>(user.email, `morning_motivation_${todayStr}`);
            if (alreadySent) { skipped++; continue; }

            const customGoals: CustomGoal[] = user.profile?.customGoals || [];
            if (hasTodaySchedules(customGoals, todayStr, dayOfWeek)) {
                skipped++;
                continue;
            }

            targets.push({ id: user.id, email: user.email, profile: user.profile || {} });
        } catch (error) {
            logger.error(`[MorningMotivation] Filter error for ${user.email}:`, error instanceof Error ? error.message : error);
        }
    }

    logger.info(`[MorningMotivation] ${targets.length} users with no schedules (out of ${users.length})`);

    // Phase 2: 그룹별 AI 호출 (비용 절감)
    const groupMap = new Map<string, Target[]>();
    for (const t of targets) {
        const p = t.profile;
        const job = p?.onboarding?.userType === '대학생'
            ? `${p?.onboarding?.major || ''} 대학생`
            : p?.onboarding?.field || p?.job || '직장인';
        const interests = (p?.onboarding?.interests || []).sort().join(',');
        const goalsKey = extractGoals(p).slice(0, 50);
        const groupKey = `${job}|${interests}|${goalsKey}`;
        if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
        groupMap.get(groupKey)!.push(t);
    }

    // Phase 3: 그룹별 메시지 생성 + 배포
    for (const [, groupUsers] of groupMap) {
        try {
            const representative = groupUsers[0];
            const motivation = await generateMotivation(representative.profile);

            if (!motivation) { skipped += groupUsers.length; continue; }

            const title = '오늘 일정이 비어있어요';

            for (const user of groupUsers) {
                try {
                    // 이름 개인화
                    const userName = user.profile?.name || '';
                    const personalizedMsg = userName && representative.profile?.name !== userName
                        ? motivation.message.replace(
                            new RegExp(`^${representative.profile?.name || ''}님,`),
                            `${userName}님,`
                        )
                        : motivation.message;

                    // 1. jarvis_notifications
                    await saveProactiveNotification(user.email, {
                        id: `morning-motivation-${todayStr}`,
                        type: 'context_suggestion',
                        priority: 'medium',
                        title,
                        message: personalizedMsg,
                        actionType: 'open_add_schedule',
                        actionPayload: { suggestion: motivation.suggestion },
                    });

                    // 2. push
                    await sendPushNotification(user.email, {
                        title,
                        body: personalizedMsg.slice(0, 100),
                        data: { type: 'morning_motivation', deepLink: 'fieri://chat' },
                    });

                    // 3. chat_history
                    try {
                        const chatMessage = {
                            id: `morning-motivation-${todayStr}-${Date.now()}`,
                            role: 'assistant',
                            content: `${title}\n\n${personalizedMsg}${motivation.suggestion ? `\n\n💡 추천: ${motivation.suggestion}` : ''}`,
                            timestamp: new Date().toISOString(),
                        };

                        const { data: existingChat } = await supabaseAdmin
                            .from('chat_history')
                            .select('messages')
                            .eq('user_id', user.id)
                            .eq('date', todayStr)
                            .maybeSingle();

                        const existingMessages = existingChat?.messages || [];
                        await supabaseAdmin
                            .from('chat_history')
                            .upsert({
                                user_id: user.id,
                                date: todayStr,
                                messages: [...existingMessages, chatMessage],
                                title: existingChat ? undefined : todayStr,
                                updated_at: new Date().toISOString(),
                            }, { onConflict: 'user_id,date' });
                    } catch (chatError) {
                        logger.error(`[MorningMotivation] Chat save failed for ${user.email}:`, chatError instanceof Error ? chatError.message : chatError);
                    }

                    // 중복 방지 마킹
                    await supabaseAdmin.from('user_kv_store').upsert({
                        user_email: user.email,
                        key: `morning_motivation_${todayStr}`,
                        value: true,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_email,key' });

                    sent++;
                } catch (error) {
                    logger.error(`[MorningMotivation] Delivery error for ${user.email}:`, error instanceof Error ? error.message : error);
                }
            }
        } catch (error) {
            logger.error(`[MorningMotivation] Group error:`, error instanceof Error ? error.message : error);
        }
    }

    return NextResponse.json({
        success: true,
        date: todayStr,
        sent,
        skipped,
        total: users.length,
    });
}));
