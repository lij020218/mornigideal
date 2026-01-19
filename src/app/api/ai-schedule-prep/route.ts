import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { schedule, userProfile, timeUntil } = await request.json();

        console.log('[AI Schedule Prep] Generating preparation tips for:', schedule.text);

        // Build user context
        let userContext = "";
        if (userProfile) {
            userContext = `
사용자 정보:
- 직업: ${userProfile.job || '미설정'}
- 목표: ${userProfile.goal || '미설정'}
- 레벨: ${userProfile.level || 'intermediate'}
- 관심사: ${(userProfile.interests || []).join(', ') || '미설정'}
`;
        }

        // 일정 유형 판별
        const scheduleName = schedule.text.toLowerCase();
        const isMealTime = /식사|점심|저녁|아침|밥|브런치|런치|디너|야식|간식/.test(scheduleName);
        const isRestTime = /휴식|쉬는|낮잠|수면|취침|잠|기상|일어나/.test(scheduleName);
        const isLeisure = /게임|영화|드라마|유튜브|넷플릭스|독서|음악|산책/.test(scheduleName);
        const isExercise = /운동|헬스|요가|필라테스|러닝|조깅|수영|등산/.test(scheduleName);
        const isWork = /업무|출근|퇴근|회의|미팅|프레젠테이션|발표|면접/.test(scheduleName);
        const isStudy = /공부|학습|강의|수업|시험|과제/.test(scheduleName);

        let prompt: string;

        if (isMealTime) {
            // 식사 - 간단한 응원만
            const mealEmojis: Record<string, string> = {
                '아침': '🍳',
                '점심': '🍚',
                '저녁': '🍽️',
                '야식': '🌙',
                '브런치': '🥐',
                '간식': '🍪'
            };
            let emoji = '🍽️';
            for (const [key, val] of Object.entries(mealEmojis)) {
                if (scheduleName.includes(key)) {
                    emoji = val;
                    break;
                }
            }
            const mealMessages = ['맛있게 드세요!', '든든하게 드세요!', '맛있는 식사 되세요!'];
            const randomMsg = mealMessages[Math.floor(Math.random() * mealMessages.length)];
            return NextResponse.json({
                advice: `${timeUntil}분 후 "${schedule.text}" 시간이에요 ${emoji}\n\n${randomMsg}`
            });
        }

        if (isRestTime) {
            // 취침/수면 - 수면 준비 체크리스트 제공
            const isSleepTime = /취침|잠|수면/.test(scheduleName);

            if (isSleepTime) {
                const sleepPrepTips = [
                    '핸드폰 무음 모드로 전환하기',
                    '방 조명 어둡게 하기',
                    '알람 설정 확인하기',
                    '내일 준비물 미리 챙겨두기',
                    '가벼운 스트레칭하기',
                    '따뜻한 물 한 잔 마시기',
                ];
                // 랜덤하게 2-3개 선택
                const shuffled = sleepPrepTips.sort(() => Math.random() - 0.5);
                const selectedTips = shuffled.slice(0, 3);

                return NextResponse.json({
                    advice: `${timeUntil}분 후 "${schedule.text}" 시간이에요 🌙\n\n수면 준비 체크:\n${selectedTips.map(tip => `• ${tip}`).join('\n')}\n\n좋은 꿈 꾸세요! 😴`
                });
            }

            // 기상/휴식 - 간단한 응원
            const restMessages: Record<string, { emoji: string; msg: string }> = {
                '기상': { emoji: '☀️', msg: '상쾌한 아침 되세요!' },
                '일어나': { emoji: '🌅', msg: '좋은 아침이에요!' },
                '휴식': { emoji: '☕', msg: '편하게 쉬세요!' },
                '낮잠': { emoji: '😌', msg: '달콤한 낮잠 되세요!' },
            };
            let emoji = '☕';
            let msg = '편하게 쉬세요!';
            for (const [key, val] of Object.entries(restMessages)) {
                if (scheduleName.includes(key)) {
                    emoji = val.emoji;
                    msg = val.msg;
                    break;
                }
            }
            return NextResponse.json({
                advice: `${timeUntil}분 후 "${schedule.text}" 시간이에요 ${emoji}\n\n${msg}`
            });
        }

        if (isLeisure) {
            // 여가 활동 - 간단한 응원만
            const leisureMessages: Record<string, { emoji: string; msg: string }> = {
                '게임': { emoji: '🎮', msg: '즐거운 시간 보내세요!' },
                '영화': { emoji: '🎬', msg: '재미있게 보세요!' },
                '드라마': { emoji: '📺', msg: '재미있게 보세요!' },
                '유튜브': { emoji: '📱', msg: '즐거운 시청 되세요!' },
                '넷플릭스': { emoji: '🍿', msg: '재미있게 보세요!' },
                '독서': { emoji: '📚', msg: '즐거운 독서 시간 되세요!' },
                '음악': { emoji: '🎵', msg: '좋은 음악과 함께하세요!' },
                '산책': { emoji: '🚶', msg: '상쾌한 산책 되세요!' },
            };
            let emoji = '🎉';
            let msg = '즐거운 시간 보내세요!';
            for (const [key, val] of Object.entries(leisureMessages)) {
                if (scheduleName.includes(key)) {
                    emoji = val.emoji;
                    msg = val.msg;
                    break;
                }
            }
            return NextResponse.json({
                advice: `${timeUntil}분 후 "${schedule.text}" 시간이에요 ${emoji}\n\n${msg}`
            });
        }

        // 운동, 업무, 공부 등 준비가 필요한 일정은 AI로 처리
        prompt = `${timeUntil}분 후 "${schedule.text}" 일정이 시작됩니다.

일정 유형: ${isExercise ? '운동' : isWork ? '업무/회의' : isStudy ? '공부' : '활동'}

**규칙:**
1. 첫 줄: "${timeUntil}분 후 "${schedule.text}" 시간이에요 [적절한 이모지]"
2. 빈 줄
3. "준비 체크:" + 2-3개 체크 항목 (해당 일정에 맞는 것만)

**일정별 예시:**

운동:
"${timeUntil}분 후 "헬스" 시간이에요 💪

준비 체크:
• 운동복 착용
• 물병 챙기기"

업무/회의:
"${timeUntil}분 후 "팀 회의" 시간이에요 💼

준비 체크:
• 회의 링크/장소 확인
• 필요한 자료 준비"

공부:
"${timeUntil}분 후 "영어 공부" 시간이에요 📖

준비 체크:
• 교재/노트 준비
• 조용한 환경 확보"

**중요:** 일정 이름에 맞는 실용적인 준비 항목만 작성. 불필요한 조언 금지.`;

        // Use gpt-4o-mini for simple, quick preparation tips (cost-effective)
        const modelName = "gpt-4o-mini-2024-07-18";
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: "당신은 일정 알림 비서입니다. 주어진 형식 그대로 따라하세요. 일정 시간 알림 + 준비 체크리스트 2-3개만 작성. 추가 조언이나 응원 문구 금지."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.5,
        });

        const advice = completion.choices[0]?.message?.content || `${timeUntil}분 후 "${schedule.text}" 시간이에요! 준비하세요 🕐`;

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                modelName,
                '/api/ai-schedule-prep',
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        return NextResponse.json({ advice });
    } catch (error: any) {
        console.error("[AI Schedule Prep] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate schedule preparation advice" },
            { status: 500 }
        );
    }
}
