import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { getUserByEmail } from "@/lib/users";
import { getTrendsCache } from "@/lib/newsCache";
import { isSlackConnected, getUnreadSummary } from "@/lib/slackService";
import { getTrendInsightsForAI } from "@/lib/multiDayTrendService";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPushNotification } from "@/lib/pushService";
import { MODELS } from "@/lib/models";
import { logger } from '@/lib/logger';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// Types
// ============================================

interface GreetingDecision {
    greeting: string;
    weatherAdvice: string | null;
    scheduleHighlight: string | null;
    trendPick: string | null;
    emailHighlight: string | null;
    patternInsight: string | null;
    closingMessage: string;
}

interface GreetingContext {
    userName: string;
    job: string;
    hour: number;
    weekday: string;
    timeOfDay: string;
    weather: any;
    schedules: any[];
    importantSchedules: any[];
    topTrend: any;
    slack: any;
    gmail: { totalUnread: number; topSubjects: string[] } | null;
    multiDayTrend: string;
    isMonday: boolean;
    hasWeeklyGoals: boolean;
}

// ============================================
// Core: 인사말 생성
// ============================================

/**
 * 단일 사용자에 대해 인사를 생성합니다.
 * AI가 판단(JSON) → 코드가 조립(텍스트).
 */
export async function generateGreetingForUser(userEmail: string): Promise<string> {
    // KST 기준 오늘 날짜/시간
    const now = new Date();
    const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const hour = kstNow.getHours();
    const dayOfWeek = kstNow.getDay();
    const weekday = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][dayOfWeek];
    const todayStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;

    // 모든 데이터를 병렬로 fetch
    const [user, weatherResult, trendsResult, multiDayResult, slackResult, gmailResult] = await Promise.all([
        getUserByEmail(userEmail),
        (async () => {
            try {
                const weatherRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/weather`);
                if (weatherRes.ok) return await weatherRes.json();
            } catch (error) {
                logger.error('[GreetingGenerator] Failed to fetch weather:', error);
            }
            return null;
        })(),
        getTrendsCache(userEmail).catch(() => null),
        getTrendInsightsForAI(userEmail).catch(() => ''),
        (async () => {
            try {
                if (await isSlackConnected(userEmail)) {
                    return await getUnreadSummary(userEmail);
                }
            } catch (e) {}
            return null;
        })(),
        fetchGmailUnreadSummary(userEmail),
    ]);

    const profile: any = user?.profile || {};
    const customGoals = profile.customGoals || [];

    // 오늘 일정 필터링
    const todaySchedules = customGoals.filter((goal: any) => {
        if (goal.specificDate === todayStr) return true;
        if (goal.daysOfWeek?.includes(dayOfWeek)) {
            if (goal.startDate && todayStr < goal.startDate) return false;
            if (goal.endDate && todayStr > goal.endDate) return false;
            return true;
        }
        return false;
    }).sort((a: any, b: any) => {
        const timeA = a.startTime || '00:00';
        const timeB = b.startTime || '00:00';
        return timeA.localeCompare(timeB);
    });

    // 중요 일정 식별
    const importantKeywords = ['회의', '미팅', 'meeting', '면접', '발표', '마감', '데드라인', 'deadline', '시험', '약속', '상담', '진료', '예약', '인터뷰'];
    const importantSchedules = todaySchedules.filter((s: any) => {
        const text = (s.text || '').toLowerCase();
        return importantKeywords.some(kw => text.includes(kw));
    });

    const timeOfDay = hour < 5 ? '새벽' : hour < 12 ? '아침' : hour < 18 ? '오후' : '저녁';
    const topTrend = trendsResult?.trends?.[0] || null;

    const weeklyGoals = profile.longTermGoals?.weekly || [];
    const hasWeeklyGoals = weeklyGoals.some((g: any) => !g.completed);

    const ctx: GreetingContext = {
        userName: profile.name || '사용자',
        job: profile.job || '',
        hour,
        weekday,
        timeOfDay,
        weather: weatherResult,
        schedules: todaySchedules,
        importantSchedules,
        topTrend,
        slack: slackResult && slackResult.totalUnread > 0 ? slackResult : null,
        gmail: gmailResult,
        multiDayTrend: multiDayResult || '',
        isMonday: dayOfWeek === 1,
        hasWeeklyGoals,
    };

    // AI 판단 → 코드 조립
    const decision = await getAIDecision(ctx, userEmail);
    return assembleGreeting(decision, ctx);
}

// ============================================
// AI 판단: 컨텍스트 → 구조화된 JSON
// ============================================

async function getAIDecision(ctx: GreetingContext, userEmail: string): Promise<GreetingDecision> {
    const fallback = getDefaultDecision(ctx);

    // 컨텍스트 요약 (LLM에게 보낼 간결한 데이터)
    const contextSummary = buildContextSummary(ctx);

    const modelName = MODELS.GPT_5_MINI;
    const LLM_TIMEOUT = 30000;

    try {
        const completion = await Promise.race([
            openai.chat.completions.create({
                model: modelName,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: "system",
                        content: `사용자의 하루 컨텍스트를 보고 인사말 구성을 JSON으로 결정하세요.
반드시 아래 JSON 형식으로만 응답하세요. 각 필드는 한국어 한 문장, 존댓말, 이모지 1개 이하.
해당 데이터가 없는 필드는 null로 설정하세요.

{
  "greeting": "시간대에 맞는 인사 + 사용자 이름 포함 (예: 좋은 아침이에요, 지훈님! ☀️)",
  "weatherAdvice": "날씨 기반 조언 한 문장 (옷차림/우산 등, 날씨 데이터 없으면 null)",
  "scheduleHighlight": "오늘 일정 중 주목할 포인트 한 문장 (일정 없으면 null)",
  "trendPick": "트렌드 중 사용자에게 관련 있는 1개 추천 한 문장 (없으면 null)",
  "emailHighlight": "미읽 이메일 중 주목할 포인트 한 문장 (이메일 데이터 없으면 null)",
  "patternInsight": "최근 행동 패턴 기반 인사이트 한 문장 (데이터 없으면 null)",
  "closingMessage": "마무리 응원 한 문장"
}`
                    },
                    {
                        role: "user",
                        content: contextSummary,
                    },
                ],
            } as any),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Greeting AI decision timed out')), LLM_TIMEOUT)
            ),
        ]);

        const content = completion.choices[0]?.message?.content;
        if (!content) return fallback;

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                userEmail,
                modelName,
                '/api/cron/generate-greetings',
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        const parsed = JSON.parse(content) as Partial<GreetingDecision>;
        return {
            greeting: parsed.greeting || fallback.greeting,
            weatherAdvice: parsed.weatherAdvice ?? fallback.weatherAdvice,
            scheduleHighlight: parsed.scheduleHighlight ?? fallback.scheduleHighlight,
            trendPick: parsed.trendPick ?? fallback.trendPick,
            emailHighlight: parsed.emailHighlight ?? fallback.emailHighlight,
            patternInsight: parsed.patternInsight ?? fallback.patternInsight,
            closingMessage: parsed.closingMessage || fallback.closingMessage,
        };
    } catch (error) {
        logger.error('[GreetingGenerator] AI decision failed, using fallback:', error);
        return fallback;
    }
}

function buildContextSummary(ctx: GreetingContext): string {
    const parts: string[] = [];

    parts.push(`시간: ${ctx.weekday} ${ctx.hour}시 (${ctx.timeOfDay})`);
    parts.push(`사용자: ${ctx.userName}${ctx.job ? ` (${ctx.job})` : ''}`);

    if (ctx.weather) {
        parts.push(`날씨: ${ctx.weather.description}, ${ctx.weather.temp}°C (체감 ${ctx.weather.feels_like}°C)`);
    }

    if (ctx.schedules.length > 0) {
        const list = ctx.schedules.slice(0, 5).map((s: any) =>
            `${s.startTime || '?'} ${s.text}`
        ).join(', ');
        parts.push(`오늘 일정 ${ctx.schedules.length}개: ${list}`);
    } else {
        parts.push('오늘 일정: 없음');
    }

    if (ctx.importantSchedules.length > 0) {
        parts.push(`중요 일정: ${ctx.importantSchedules.map((s: any) => s.text).join(', ')}`);
    }

    if (ctx.topTrend) {
        parts.push(`트렌드: [${ctx.topTrend.category}] ${ctx.topTrend.title}`);
    }

    if (ctx.slack) {
        parts.push(`슬랙 미읽: ${ctx.slack.totalUnread}건`);
    }

    if (ctx.gmail) {
        const subjects = ctx.gmail.topSubjects.slice(0, 3).join(', ');
        parts.push(`이메일 미읽: ${ctx.gmail.totalUnread}건${subjects ? ` (${subjects})` : ''}`);
    }

    if (ctx.multiDayTrend) {
        // 너무 길면 앞 200자만
        parts.push(`행동 패턴: ${ctx.multiDayTrend.slice(0, 200)}`);
    }

    if (ctx.isMonday && !ctx.hasWeeklyGoals) {
        parts.push('월요일인데 주간 목표 미설정');
    }

    return parts.join('\n');
}

// ============================================
// 코드 조립: 판단 결과 → 인사말 텍스트
// ============================================

function assembleGreeting(decision: GreetingDecision, ctx: GreetingContext): string {
    const parts: string[] = [];

    // 1. 인사
    parts.push(decision.greeting);

    // 2. 날씨 조언
    if (decision.weatherAdvice) {
        parts.push(decision.weatherAdvice);
    }

    // 3. 일정 요약 (코드가 포맷)
    parts.push(formatScheduleSummary(ctx.schedules, ctx.importantSchedules));

    // 4. 일정 하이라이트 (AI 판단)
    if (decision.scheduleHighlight) {
        parts.push(`⚡ ${decision.scheduleHighlight}`);
    }

    // 5. 트렌드 추천
    if (decision.trendPick) {
        parts.push(`📰 ${decision.trendPick} — 인사이트 탭에서 확인해보세요`);
    }

    // 6. 슬랙
    if (ctx.slack) {
        parts.push(`💬 슬랙에 미확인 메시지 ${ctx.slack.totalUnread}건이 있어요`);
    }

    // 6.5. 이메일
    if (ctx.gmail) {
        parts.push(`📧 미확인 이메일 ${ctx.gmail.totalUnread}건이 있어요`);
    }
    if (decision.emailHighlight) {
        parts.push(`📧 ${decision.emailHighlight}`);
    }

    // 7. 행동 패턴 인사이트
    if (decision.patternInsight) {
        parts.push(`📊 ${decision.patternInsight}`);
    }

    // 8. 마무리
    parts.push(decision.closingMessage);

    return parts.join('\n\n');
}

function formatScheduleSummary(schedules: any[], importantSchedules: any[]): string {
    if (schedules.length === 0) {
        return '📅 오늘은 등록된 일정이 없어요. 할 일을 추가해보세요!';
    }

    const display = schedules.slice(0, 4);
    const lines = display.map((s: any) => {
        const time = s.startTime || '';
        const end = s.endTime ? `~${s.endTime}` : '';
        const isImportant = importantSchedules.some((imp: any) => imp.text === s.text);
        return `  ${isImportant ? '⚡' : '•'} ${time}${end ? ` ${end}` : ''} ${s.text}`;
    });

    let summary = `📅 오늘 일정 ${schedules.length}개:\n${lines.join('\n')}`;
    if (schedules.length > 4) {
        summary += `\n  ...외 ${schedules.length - 4}개`;
    }
    return summary;
}

// ============================================
// Fallback: LLM 실패 시 코드 기반 기본 판단
// ============================================

function getDefaultDecision(ctx: GreetingContext): GreetingDecision {
    const timeEmoji = ctx.hour < 5 ? '🌙' : ctx.hour < 12 ? '☀️' : ctx.hour < 18 ? '✨' : '🌙';
    const timeGreeting = ctx.hour < 5
        ? `${ctx.userName}님, 아직 이른 시간이네요 ${timeEmoji}`
        : `좋은 ${ctx.timeOfDay}이에요, ${ctx.userName}님! ${timeEmoji}`;

    let weatherAdvice: string | null = null;
    if (ctx.weather) {
        const temp = ctx.weather.temp;
        const advice = temp <= 0 ? '많이 추워요, 따뜻하게 입으세요!'
            : temp <= 10 ? '쌀쌀해요, 겉옷을 챙기세요.'
            : temp <= 20 ? '선선한 날씨에요.'
            : '따뜻한 날이에요!';
        const conditionAdvice = ctx.weather.condition === 'rain' ? ' 우산 잊지 마세요! 🌂'
            : ctx.weather.condition === 'snow' ? ' 눈이 오니 조심하세요! ⛄' : '';
        weatherAdvice = `${ctx.weather.description}, ${temp}°C. ${advice}${conditionAdvice}`;
    }

    let scheduleHighlight: string | null = null;
    if (ctx.importantSchedules.length > 0) {
        scheduleHighlight = `**${ctx.importantSchedules[0].text}** 잊지 마세요!`;
    }

    const closings = [
        '오늘도 알찬 하루 보내세요! 💪',
        '좋은 하루 되세요! ✨',
        '오늘도 화이팅이에요! 🔥',
        '멋진 하루가 될 거예요! 🌟',
    ];

    let emailHighlight: string | null = null;
    if (ctx.gmail && ctx.gmail.totalUnread > 0 && ctx.gmail.topSubjects.length > 0) {
        emailHighlight = `"${ctx.gmail.topSubjects[0]}" 등 미확인 메일을 확인해보세요`;
    }

    return {
        greeting: timeGreeting,
        weatherAdvice,
        scheduleHighlight,
        trendPick: ctx.topTrend ? `**${ctx.topTrend.title}** — 오늘의 트렌드예요` : null,
        emailHighlight,
        patternInsight: null,
        closingMessage: closings[Math.floor(Math.random() * closings.length)],
    };
}

// ============================================
// Gmail: 미읽 메일 간단 요약 (인사말용)
// ============================================

async function fetchGmailUnreadSummary(
    userEmail: string
): Promise<{ totalUnread: number; topSubjects: string[] } | null> {
    try {
        // Gmail 토큰 조회
        const { data, error } = await supabaseAdmin
            .from('gmail_tokens')
            .select('access_token, refresh_token, expires_at')
            .eq('user_email', userEmail)
            .maybeSingle();

        if (error || !data) return null;

        let accessToken = data.access_token;

        // 토큰 만료 시 갱신
        if (data.expires_at < Date.now()) {
            if (!data.refresh_token) return null;
            const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                    refresh_token: data.refresh_token,
                    grant_type: 'refresh_token',
                }),
            });
            if (!refreshRes.ok) return null;
            const tokens = await refreshRes.json();
            accessToken = tokens.access_token;

            // DB 업데이트
            await supabaseAdmin
                .from('gmail_tokens')
                .update({
                    access_token: accessToken,
                    expires_at: Date.now() + (tokens.expires_in * 1000),
                    updated_at: new Date().toISOString(),
                })
                .eq('user_email', userEmail);
        }

        // 미읽 메일 목록 조회 (최근 24시간, 최대 10개)
        const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
        const listRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread after:${oneDayAgo}&maxResults=10`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!listRes.ok) return null;
        const listData = await listRes.json();
        const messageIds: { id: string }[] = listData.messages || [];

        if (messageIds.length === 0) return null;

        // 상위 5개만 제목 가져오기 (가볍게)
        const topSubjects: string[] = [];
        for (const { id } of messageIds.slice(0, 5)) {
            const msgRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (msgRes.ok) {
                const msgData = await msgRes.json();
                const subject = msgData.payload?.headers?.find(
                    (h: any) => h.name === 'Subject'
                )?.value;
                if (subject) topSubjects.push(subject);
            }
        }

        return { totalUnread: messageIds.length, topSubjects };
    } catch (err) {
        logger.error('[GreetingGenerator] Gmail summary failed:', err);
        return null;
    }
}

// ============================================
// 크론 & 캐시
// ============================================

/**
 * 모든 사용자에 대해 인사를 미리 생성하고 DB에 저장합니다.
 */
export async function generateGreetingsForAllUsers() {
    const { data: users, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, email, name');

    if (userError || !users) {
        logger.error('[GreetingGenerator] Failed to fetch users:', userError);
        return;
    }

    logger.info(`[GreetingGenerator] Generating greetings for ${users.length} users`);

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
        if (!user.email) continue;

        try {
            const greeting = await generateGreetingForUser(user.email);

            await supabaseAdmin.from('user_events').upsert({
                id: `greeting-${user.email}-${dateStr}`,
                user_email: user.email,
                event_type: 'morning_greeting_generated',
                start_at: new Date().toISOString(),
                metadata: {
                    date: dateStr,
                    greeting,
                    generated_at: new Date().toISOString(),
                },
            }, { onConflict: 'id' });

            // 푸시 알림 전송
            const pushBody = greeting.split('\n\n').slice(0, 2).join(' ').slice(0, 100);
            try {
                await sendPushNotification(user.email, {
                    title: '☀️ 좋은 아침이에요!',
                    body: pushBody,
                    data: { type: 'morning_greeting', date: dateStr },
                    channelId: 'morning',
                    priority: 'high',
                });
            } catch (pushErr) {
                logger.error(`[GreetingGenerator] Push failed for ${user.email}:`, pushErr);
            }

            successCount++;
            logger.debug(`[GreetingGenerator] Generated greeting for ${user.name || user.email}`);
        } catch (err) {
            failCount++;
            logger.error(`[GreetingGenerator] Failed for ${user.email}:`, err);
        }
    }

    logger.info(`[GreetingGenerator] Done: ${successCount} success, ${failCount} failed`);
}

/**
 * 캐시된 인사를 조회합니다.
 */
export async function getCachedGreeting(userEmail: string): Promise<string | null> {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const { data } = await supabaseAdmin
        .from('user_events')
        .select('metadata')
        .eq('id', `greeting-${userEmail}-${dateStr}`)
        .maybeSingle();

    return data?.metadata?.greeting || null;
}
