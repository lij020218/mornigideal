/**
 * Smart Chat Router
 *
 * 간단한 요청은 규칙 기반으로 처리하고, 복잡한 것만 AI API를 호출합니다.
 * 이를 통해 API 비용을 크게 절감할 수 있습니다.
 */

export interface ParsedSchedule {
    text: string;
    startTime?: string;
    endTime?: string;
    specificDate?: string;
    daysOfWeek?: number[];
}

export interface RouteResult {
    type: 'rule-based' | 'ai-required';
    action?: 'add_schedule' | 'list_schedules' | 'show_briefings' | 'delete_schedule' | 'open_link';
    data?: any;
    message?: string;
}

/**
 * 날짜 파싱 (상대적 날짜 처리)
 */
function parseRelativeDate(text: string): string | undefined {
    const today = new Date();

    // 오늘
    if (/오늘|today/i.test(text)) {
        return today.toISOString().split('T')[0];
    }

    // 내일
    if (/내일|tomorrow/i.test(text)) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    // 모레
    if (/모레/i.test(text)) {
        const dayAfter = new Date(today);
        dayAfter.setDate(dayAfter.getDate() + 2);
        return dayAfter.toISOString().split('T')[0];
    }

    // 다음주 월요일 ~ 일요일
    const weekdayMatch = text.match(/다음\s*주\s*(월|화|수|목|금|토|일)요일/);
    if (weekdayMatch) {
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const targetDay = weekdays.indexOf(weekdayMatch[1]);
        const currentDay = today.getDay();

        // 다음주까지 일수 계산
        let daysUntil = 7 - currentDay + targetDay;
        if (daysUntil <= 0) daysUntil += 7;

        const nextWeekDay = new Date(today);
        nextWeekDay.setDate(nextWeekDay.getDate() + daysUntil);
        return nextWeekDay.toISOString().split('T')[0];
    }

    // 이번주 월요일 ~ 일요일
    const thisWeekMatch = text.match(/이번\s*주\s*(월|화|수|목|금|토|일)요일/);
    if (thisWeekMatch) {
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const targetDay = weekdays.indexOf(thisWeekMatch[1]);
        const currentDay = today.getDay();

        let daysUntil = targetDay - currentDay;
        if (daysUntil < 0) daysUntil += 7;

        const thisWeekDay = new Date(today);
        thisWeekDay.setDate(thisWeekDay.getDate() + daysUntil);
        return thisWeekDay.toISOString().split('T')[0];
    }

    return undefined;
}

/**
 * 시간 파싱 (HH:MM 형식으로 반환)
 */
function parseTime(text: string): string | undefined {
    // "오후 3시", "오전 9시 30분"
    const koreanTimeMatch = text.match(/(오전|오후|저녁|아침)?\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/);
    if (koreanTimeMatch) {
        const period = koreanTimeMatch[1];
        let hour = parseInt(koreanTimeMatch[2]);
        const minute = koreanTimeMatch[3] ? parseInt(koreanTimeMatch[3]) : 0;

        // 오후/저녁이면 +12
        if ((period === '오후' || period === '저녁') && hour < 12) {
            hour += 12;
        }
        // 오전 12시는 0시
        if (period === '오전' && hour === 12) {
            hour = 0;
        }

        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }

    // "15:30", "9:00"
    const numericTimeMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (numericTimeMatch) {
        const hour = parseInt(numericTimeMatch[1]);
        const minute = parseInt(numericTimeMatch[2]);
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }

    return undefined;
}

/**
 * 일정 추가 패턴 파싱
 */
function parseScheduleAddition(text: string): ParsedSchedule | null {
    const lowerText = text.toLowerCase();

    // 일정 추가 키워드 확인
    const isAddSchedule = /일정\s*(추가|넣|등록|만들)|추가.*일정|넣.*일정/.test(text);
    if (!isAddSchedule) return null;

    // 날짜 파싱
    const specificDate = parseRelativeDate(text);

    // 시간 파싱
    const startTime = parseTime(text);

    // 일정 이름 추출 (시간/날짜 키워드 제거 후 남은 부분)
    let scheduleText = text
        .replace(/일정\s*(추가|넣|등록|만들).*$/g, '')
        .replace(/추가.*일정/g, '')
        .replace(/오늘|내일|모레|다음\s*주|이번\s*주/g, '')
        .replace(/(월|화|수|목|금|토|일)요일/g, '')
        .replace(/(오전|오후|저녁|아침)?\s*\d{1,2}\s*시\s*(\d{0,2}\s*분)?/g, '')
        .replace(/\d{1,2}:\d{2}/g, '')
        .replace(/해줘|해주세요|해|해요|부탁|좀/g, '')
        .replace(/\s*(에|부터|까지)\s+/g, ' ') // 시간/날짜 뒤 조사 "에" 제거 (뒤에 공백이 있는 경우)
        .replace(/\s*(에|부터|까지)$/g, '')   // 문장 끝 조사 제거
        .trim();

    // "에 아침 식사" 같은 경우 앞의 "에"를 한번 더 정리
    scheduleText = scheduleText.replace(/^에\s+/, '').trim();

    if (!scheduleText) {
        // 일정 이름을 찾지 못함 - AI 필요
        return null;
    }

    return {
        text: scheduleText,
        startTime,
        specificDate,
    };
}

/**
 * 메인 라우터 함수
 */
export function routeChatRequest(userMessage: string, context?: any): RouteResult {
    const lowerText = userMessage.toLowerCase().trim();

    console.log('[Smart Router] Analyzing:', userMessage);

    // 1. 일정 조회 요청
    if (/^(오늘|내일|이번\s*주|다음\s*주)\s*(일정|스케줄)(\s*(뭐|뭐야|있어|보여줘|알려줘))?$/i.test(lowerText)) {
        console.log('[Smart Router] ✅ Rule-based: List schedules');

        let period = '오늘';
        if (/내일/.test(lowerText)) period = '내일';
        else if (/이번\s*주/.test(lowerText)) period = '이번주';
        else if (/다음\s*주/.test(lowerText)) period = '다음주';

        const schedules = context?.schedules || [];
        const filteredSchedules = schedules.filter((s: any) => {
            // TODO: 날짜 필터링 로직
            return true;
        });

        const message = filteredSchedules.length > 0
            ? `${period} 일정을 확인해드릴게요.\n\n${filteredSchedules.map((s: any) => `• ${s.startTime} - ${s.text}`).join('\n')}`
            : `${period}에는 등록된 일정이 없습니다.`;

        return {
            type: 'rule-based',
            action: 'list_schedules',
            message,
        };
    }

    // 2. 브리핑 조회 요청
    if (/^(트렌드|브리핑)\s*(보여줘|알려줘|뭐야|뭐\s*있어|읽어줘)$/i.test(lowerText)) {
        console.log('[Smart Router] ✅ Rule-based: Show briefings');

        const briefings = context?.trendBriefings || [];
        const message = briefings.length > 0
            ? `오늘의 트렌드 브리핑입니다.\n\n${briefings.slice(0, 5).map((b: any, i: number) => `${i + 1}. [${b.category}] ${b.title}`).join('\n')}`
            : '아직 준비된 브리핑이 없습니다.';

        return {
            type: 'rule-based',
            action: 'show_briefings',
            message,
            data: { briefings },
        };
    }

    // 3. 일정 추가 요청
    const parsedSchedule = parseScheduleAddition(userMessage);
    if (parsedSchedule) {
        // 필수 정보가 모두 있는지 확인
        if (parsedSchedule.text && parsedSchedule.startTime) {
            console.log('[Smart Router] ✅ Rule-based: Add schedule');

            // [INTERACTIVE MODE] Force AI to handle this to ask for location/details
            // return {
            //     type: 'rule-based',
            //     action: 'add_schedule',
            //     data: {
            //         text: parsedSchedule.text,
            //         startTime: parsedSchedule.startTime,
            //         specificDate: parsedSchedule.specificDate || new Date().toISOString().split('T')[0],
            //         color: 'primary',
            //     },
            //     message: `🗓 "${parsedSchedule.text}" 일정(${parsedSchedule.startTime})을 등록하겠습니다.`,
            // };
            return { type: 'ai-required' };
        } else if (parsedSchedule.text && !parsedSchedule.startTime) {
            // 시간이 없음 - AI에게 시간 물어보도록
            console.log('[Smart Router] ⚠️ Partial schedule info, needs AI for time');
            return {
                type: 'ai-required',
                data: { partialSchedule: parsedSchedule }
            };
        }
    }

    // 4. 간단한 인사말
    if (/^(안녕|hi|hello|hey)$/i.test(lowerText)) {
        console.log('[Smart Router] ✅ Rule-based: Greeting');

        const hour = new Date().getHours();
        let greeting = '안녕하세요';
        if (hour < 12) greeting = '좋은 아침이에요';
        else if (hour < 18) greeting = '좋은 오후예요';
        else greeting = '좋은 저녁이에요';

        return {
            type: 'rule-based',
            message: `${greeting}! 😊 무엇을 도와드릴까요?`,
        };
    }

    // 5. 사용법/도움말 요청
    if (/^(도움말|사용법|기능|할 수 있는 일|뭐 할 수 있어|어떻게 써)$/i.test(lowerText)) {
        console.log('[Smart Router] ✅ Rule-based: Help');
        return {
            type: 'rule-based',
            message: `저는 여러분의 생산성을 돕는 AI 비서입니다. 🤖\n\n다음과 같은 일을 할 수 있어요:\n\n📅 **일정 관리**\n• "오늘 일정 알려줘"\n• "내일 오후 2시에 회의 일정 추가해줘"\n\n📰 **트렌드 브리핑**\n• "오늘의 트렌드 알려줘"\n• "브리핑 읽어줘"\n\n💡 **맞춤 제안**\n• 일정 시작 전 준비 팁 제공\n• 빈 시간에 할 일 추천\n\n무엇을 도와드릴까요?`,
        };
    }

    // 6. 감정 표현/피드백 대응
    if (/^(고마워|감사|좋아|굿|네|응|오케이|알겠어)$/i.test(lowerText)) {
        console.log('[Smart Router] ✅ Rule-based: Feedback/Ack');
        const reactions = ['천만에요! 😊', '도움이 되어서 기뻐요!', '네, 알겠습니다!', '언제든 말씀해주세요.', '파이팅입니다! 💪'];
        const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
        return {
            type: 'rule-based',
            message: randomReaction,
        };
    }

    // 7. 페이지 이동 (내비게이션)
    if (/(페이지|화면|메뉴).*(이동|가줘|보여줘)/.test(lowerText) || /(대시보드|인사이트|캘린더|설정).*(가줘|보여줘)/.test(lowerText)) {
        console.log('[Smart Router] ✅ Rule-based: Navigation');
        let target = '';
        let message = '';

        if (/대시보드/.test(lowerText)) { target = '/dashboard'; message = '대시보드로 이동합니다.'; }
        else if (/인사이트|통계/.test(lowerText)) { target = '/insights'; message = '인사이트 페이지로 이동합니다.'; }
        else if (/캘린더|달력/.test(lowerText)) { target = '/calendar'; message = '캘린더로 이동합니다.'; }
        else if (/설정/.test(lowerText)) { target = '/settings'; message = '설정 페이지로 이동합니다.'; }
        else {
            return { type: 'rule-based', message: '어느 페이지로 이동할까요? (대시보드, 인사이트, 캘린더, 설정)' };
        }

        return {
            type: 'rule-based',
            action: 'open_link',
            data: { url: target },
            message,
        };
    }

    // 5. 복잡한 요청 - AI 필요
    console.log('[Smart Router] 🤖 AI required for complex request');
    return {
        type: 'ai-required',
    };
}

/**
 * 비용 절감 통계
 */
export function estimateCostSavings(totalRequests: number, ruleBasedCount: number) {
    const aiCostPerRequest = 0.024; // $0.024 평균
    const ruleBasedCost = 0; // 무료

    const savedCost = ruleBasedCount * aiCostPerRequest;
    const savingsPercentage = (ruleBasedCount / totalRequests) * 100;

    return {
        totalRequests,
        ruleBasedCount,
        aiCount: totalRequests - ruleBasedCount,
        savedCost,
        savingsPercentage,
    };
}
