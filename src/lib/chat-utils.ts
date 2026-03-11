/**
 * AI Chat 유틸리티
 *
 * 헬퍼 함수 모음: 의도 분류, 정규화, 스키마 생성, 후처리
 * route.ts는 흐름 제어(Flow Control)만 담당
 */

import { FOCUS_KEYWORDS as FOCUS_KEYWORDS_CONST } from '@/lib/constants';
import { PERSONA_LABELS } from '@/lib/prompts/persona';
import { SAFETY_SYSTEM_RULES } from '@/lib/content-safety';
import { logger } from '@/lib/logger';

// ============================================
// Types
// ============================================

export type UserIntent = 'schedule' | 'search' | 'goal' | 'chat' | 'analysis' | 'settings';

export interface ChatAction {
    type:
        | "add_schedule"
        | "delete_schedule"
        | "update_schedule"
        | "open_link"
        | "open_curriculum"
        | "web_search"
        | "add_weekly_goal"
        | "open_briefing"
        | "show_goals"
        | "show_habits"
        | "show_analysis"
        | "set_reminder"
        | "save_learning"
        | "resolve_conflict"
        | "update_settings";
    label: string;
    data: Record<string, any>;
}

// ============================================
// 일정 이름 정규화
// ============================================

const SCHEDULE_NAME_MAP: Record<string, string> = {
    // 식사
    "아침밥": "아침 식사", "아침": "아침 식사", "조식": "아침 식사", "breakfast": "아침 식사", "아침 먹기": "아침 식사",
    "점심밥": "점심 식사", "점심": "점심 식사", "중식": "점심 식사", "lunch": "점심 식사", "점심 먹기": "점심 식사",
    "저녁밥": "저녁 식사", "저녁": "저녁 식사", "석식": "저녁 식사", "dinner": "저녁 식사", "저녁 먹기": "저녁 식사",
    // 수면/기상
    "일어나": "기상", "일어나기": "기상", "깨어나": "기상", "일어나야지": "기상", "wake up": "기상",
    "자기": "취침", "잠자기": "취침", "잠": "취침", "자야지": "취침", "sleep": "취침", "잘 시간": "취침",
    // 업무
    "업무": "업무 시작", "업무 일정": "업무 시작", "work": "업무 시작", "출근": "업무 시작", "일 시작": "업무 시작", "업무 시작하기": "업무 시작", "수업 시작": "업무 시작",
    "업무 마무리": "업무 종료", "업무 끝": "업무 종료", "퇴근": "업무 종료", "일 끝": "업무 종료", "수업 끝": "업무 종료",
    // 운동
    "헬스": "운동", "요가": "운동", "필라테스": "운동", "러닝": "운동", "gym": "운동", "운동하기": "운동", "트레이닝": "운동",
    // 학습
    "책 읽기": "독서", "독서하기": "독서", "책": "독서", "reading": "독서",
    "공부": "공부", "학습": "공부", "study": "공부", "공부하기": "공부",
    "자기계발": "자기계발", "자기 계발": "자기계발", "개발": "자기계발", "성장": "자기계발",
    // 기타
    "쉬기": "휴식", "휴식": "휴식", "rest": "휴식", "쉬는 시간": "휴식",
    "여가": "여가", "취미": "여가", "여가 시간": "여가",
    "게임하기": "게임", "게임 하기": "게임", "게임 시간": "게임",
    "영화 보기": "영화", "영화 감상": "영화", "영화 시청": "영화",
    "드라마 보기": "드라마", "드라마 시청": "드라마",
};

export function normalizeScheduleName(text: string): string {
    const lowerText = text.toLowerCase().trim();
    // 정확 매칭만 사용 (부분 매칭은 "업무 보고"→"업무 시작" 등 오탐 발생)
    if (SCHEDULE_NAME_MAP[lowerText]) {
        return SCHEDULE_NAME_MAP[lowerText];
    }
    return text;
}

// ============================================
// 반복 요일 파싱 (향후 직접 파싱 시 사용)
// ============================================

export function parseRepeatDays(text: string): number[] | null {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("매일") || lowerText.includes("every day") || lowerText.includes("일일")) {
        return [0, 1, 2, 3, 4, 5, 6];
    }
    if (lowerText.includes("평일") || lowerText.includes("weekday")) {
        return [1, 2, 3, 4, 5];
    }
    if (lowerText.includes("주말") || lowerText.includes("weekend")) {
        return [0, 6];
    }
    const dayMap: Record<string, number> = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };
    const weeklyMatch = text.match(/매주\s*([일월화수목금토]+)/);
    if (weeklyMatch) {
        const days = weeklyMatch[1].split("").map(d => dayMap[d]).filter(d => d !== undefined);
        return days.length > 0 ? days : null;
    }
    return null;
}

// ============================================
// 시간 검증 및 조정 (과거 시간 방지)
// ============================================

export function validateAndAdjustTime(suggestedTime: string, currentTime: string, isToday = true): string {
    // 내일/미래 일정이면 AM/PM 추론 + 과거 시간 조정 모두 스킵
    if (!isToday) return suggestedTime;

    let [suggestedHour, suggestedMinute] = suggestedTime.split(":").map(Number);
    const [currentHour, currentMinute] = currentTime.split(":").map(Number);

    // AM/PM 추론: 1-12시 범위이고 현재 시간보다 과거면 오후(+12)로 해석
    if (suggestedHour >= 1 && suggestedHour <= 12) {
        const suggestedMin = suggestedHour * 60 + (suggestedMinute || 0);
        const currentMin = currentHour * 60 + currentMinute;
        if (suggestedMin < currentMin && (suggestedHour + 12) <= 23) {
            suggestedHour += 12;
        }
    }

    const suggestedMinutes = suggestedHour * 60 + (suggestedMinute || 0);
    const currentMinutes = currentHour * 60 + currentMinute;

    if (suggestedMinutes < currentMinutes) {
        const adjustedMinutes = currentMinutes + 30;
        const adjustedHour = Math.floor(adjustedMinutes / 60);
        const adjustedMinute = adjustedMinutes % 60;

        if (adjustedHour < 23) {
            return `${String(adjustedHour).padStart(2, "0")}:${String(adjustedMinute).padStart(2, "0")}`;
        }
        return "";
    }
    return `${String(suggestedHour).padStart(2, "0")}:${String(suggestedMinute || 0).padStart(2, "0")}`;
}

// ============================================
// 메모 파싱 ('세부내용'으로 일정 → text: 일정, memo: 세부내용)
// ============================================

export function parseScheduleWithMemo(input: string): { text: string; memo: string } {
    const memoPattern = /['']([^'']+)[''](?:으?로|로)\s*(.+?)(?:\s*일정)?(?:\s*추가|등록|잡아)?/;
    const match = input.match(memoPattern);

    if (match) {
        const memo = match[1].trim();
        let scheduleType = match[2].trim();
        scheduleType = normalizeScheduleName(scheduleType);
        return { text: scheduleType, memo };
    }

    return { text: input, memo: "" };
}

// ============================================
// 사용자 의도 분류 (키워드 기반, API 호출 없음)
// ============================================
// 복합 키워드를 먼저 매칭하여 충돌 방지
// 우선순위: 복합(analysis) > search > goal > schedule > chat

export function classifyIntent(messages: any[]): UserIntent {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    if (!lastUserMsg?.content) return 'chat';
    const text = lastUserMsg.content.toLowerCase();

    // 1단계: 복합 키워드 (2어절 이상) - 최우선 매칭
    const compoundRules: { keywords: string[]; intent: UserIntent }[] = [
        { keywords: ['브리핑 추천', '트렌드 브리핑', '트렌드 추천', '브리핑 보여', '브리핑 알려'], intent: 'chat' },
        { keywords: ['일정 검색', '일정 찾아', '일정 조회'], intent: 'search' },
        { keywords: ['시간 분석', '시간 패턴', '수면 패턴', '운동 패턴', '생활 패턴', '어떻게 보냈'], intent: 'analysis' },
        { keywords: ['목표 달성', '목표 진행', '완료율', '성과 분석', '주간 리포트', '월간 리포트'], intent: 'goal' },
        { keywords: ['일정 추가', '일정 삭제', '일정 수정', '일정 변경', '일정 등록'], intent: 'schedule' },
        { keywords: ['설정 변경', '설정 바꿔', '글자 크기', '글꼴 크기', '폰트 크기', '알림 소리', '알림 설정 바꿔', '응답 스타일', '학습 난이도', '컴팩트 모드', '방해 금지 시간'], intent: 'settings' },
    ];

    for (const rule of compoundRules) {
        if (rule.keywords.some(k => text.includes(k))) {
            return rule.intent;
        }
    }

    // 2단계: 설정 변경 의도
    const settingsKeywords = ['글씨 크게', '글씨 작게', '글씨 보통', '폰트 크게', '폰트 작게', '소리 꺼', '소리 켜', '진동 꺼', '진동 켜', '간결하게', '상세하게', '컴팩트'];
    if (settingsKeywords.some(k => text.includes(k))) return 'settings';

    // 3단계: 검색 의도 (schedule보다 먼저 - "추천", "찾아" 등은 검색 우선)
    const searchKeywords = ['찾아줘', '검색해', '알려줘', '뭐야', '어디야', '추천해', '틀어', '영상', '카페', '맛집', '근처', '뉴스', '최신'];
    if (searchKeywords.some(k => text.includes(k))) return 'search';

    // 3단계: 목표/성장 의도
    const goalKeywords = ['목표', '달성', '습관', '통계', '완료율', '성과', '배운', '깨달', '성장 기록'];
    if (goalKeywords.some(k => text.includes(k))) return 'goal';

    // 4단계: 분석 의도
    const analysisKeywords = ['분석', '패턴', '수면', '루틴'];
    if (analysisKeywords.some(k => text.includes(k))) return 'analysis';

    // 5단계: 일정 의도 (가장 넓은 범위 - 마지막에 매칭)
    const scheduleKeywords = ['일정', '추가', '등록', '삭제', '잡아', '시에', '오전', '오후', '내일', '모레', '매일', '평일', '주말', '취침', '기상', '운동', '식사', '바꿔', '변경', '수정', '알림', '리마인더'];
    if (scheduleKeywords.some(k => text.includes(k))) return 'schedule';

    return 'chat';
}

// ============================================
// 의도별 Action 스키마 생성
// ============================================

export function getActionSchemaForIntent(intent: UserIntent, userPlan: string, context: any): string {
    let schema = `interface Response {
  message: string;
  actions: Action[];
}

type Action =
  | { type: "add_schedule"; label: string; data: { text: string; startTime: string; endTime: string; specificDate: string|null; daysOfWeek: number[]|null; startDate?: string; endDate?: string; color: "primary"; location: string; memo: string } }
  | { type: "delete_schedule"; label: string; data: { text: string; startTime: string; isRepeating?: boolean; specificDate?: string } }
  | { type: "update_schedule"; label: string; data: { originalText: string; originalTime: string; specificDate?: string; newText?: string; newStartTime?: string; newEndTime?: string; newLocation?: string; newMemo?: string } }

⚠️ 시간 형식 규칙 (반드시 준수):
- startTime, endTime은 반드시 24시간 HH:MM 형식 (예: "09:00", "14:30", "18:00")
- "오후 6시" → "18:00", "오전 9시" → "09:00", "오후 3시 반" → "15:30"
- endTime은 반드시 startTime보다 이후여야 함
- daysOfWeek: 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
- 반복 일정이면 specificDate는 null, daysOfWeek는 배열
- 단일 일정이면 daysOfWeek는 null, specificDate는 YYYY-MM-DD`;

    if (intent === 'search') {
        schema += `
  | { type: "open_link"; label: string; data: { url?: string; app?: string; query?: string; target?: string } }
  | { type: "web_search"; label: string; data: { query: string; activity: string } }`;
    }

    if (intent === 'goal' || intent === 'analysis') {
        schema += `
  | { type: "show_goals"; label: string; data: { goalType?: "weekly"|"monthly"|"yearly"|"all" } }
  | { type: "show_analysis"; label: string; data: { analysisType: "time_distribution"|"productivity"|"sleep"|"exercise"|"all" } }
  | { type: "save_learning"; label: string; data: { content: string; category: "insight"|"skill"|"reflection"|"goal_progress"; relatedGoal?: string } }`;
    }

    if (context?.trendBriefings?.length > 0) {
        schema += `
  | { type: "open_briefing"; label: string; data: { briefingId: string; title: string } }`;
    }

    if (intent === 'settings' || intent === 'chat') {
        schema += `
  | { type: "update_settings"; label: string; data: { category: "appearance"|"notifications"|"ai"; settings: { fontSize?: "small"|"medium"|"large"; compactMode?: boolean; animationsEnabled?: boolean; scheduleReminders?: boolean; dailyBriefing?: boolean; weeklyReport?: boolean; goalNudges?: boolean; soundEnabled?: boolean; vibrationEnabled?: boolean; quietHoursEnabled?: boolean; responseStyle?: "concise"|"balanced"|"detailed"; learningDifficulty?: "easy"|"moderate"|"challenging"; autoSuggestions?: boolean; proactiveInsights?: boolean } } }`;
    }

    if (intent === 'schedule' || intent === 'chat') {
        schema += `
  | { type: "open_link"; label: string; data: { url?: string; app?: string; query?: string; target?: string } }`;
    }

    schema += ';';
    return schema;
}

// ============================================
// 의도별 행동 가이드
// ============================================

export function getBehaviorGuide(intent: UserIntent): string {
    const guides: Record<UserIntent, string> = {
        schedule: `## 행동 가이드
- **즉시 실행**: "추가해줘/잡아줘/등록해줘" → 바로 actions에 포함. 질문 금지.
- **날짜 매핑 필수**: "내일", "모레" 등은 위 📅 날짜 매핑의 정확한 날짜 문자열을 specificDate에 사용. 절대 오늘 날짜로 넣지 마세요.
- **구체적 날짜**: "3월 8일", "4월 1일" 등 구체적 날짜는 현재 연도를 사용해 "YYYY-MM-DD" 형식으로 specificDate에 넣으세요 (예: "3월 8일" → specificDate: "현재연도-03-08").
- **specificDate vs daysOfWeek**: 특정 날짜 일정은 반드시 specificDate를 설정하고 daysOfWeek는 null로. 반복 일정만 daysOfWeek를 사용.
- **일정 이름 정규화**: 아침/점심/저녁→"아침 식사"/"점심 식사"/"저녁 식사", 잠→"취침", 일어나→"기상", 헬스→"운동"
- **메모 패턴**: "'세부내용'으로 일정" → text: "일정유형", memo: "세부내용"
- **반복 일정**: 매일=[0-6], 평일=[1-5], 주말=[0,6], 매주 월수금=[1,3,5]. startDate/endDate는 자동 설정됨 (미입력 시 이번 주~6개월)
- **시간 표시**: 메시지에서 "오전/오후" 명시 (6시 X → 오후 6시 O)
- **삭제**: delete_schedule에 text, startTime 필수. 반복이면 isRepeating:true. 특정 날짜 일정이면 specificDate 필수 (YYYY-MM-DD)
- **수정**: "바꿔줘/변경해줘" → update_schedule (originalText, originalTime 필수). 특정 날짜 일정이면 specificDate 필수 (YYYY-MM-DD)
- **휴식 존중**: 여가 일정(게임/영화/운동) 앞에서 생산성 조언 금지
- **일정 시작 안내 시 관련 앱 실행 open_link 버튼 적극 포함**`,

        search: `## 행동 가이드
- **검색**: "찾아줘/알려줘" → web_search (query 필수)
- **외부 앱**: 앱 실행 → open_link (app/query 또는 url)
  - 유튜브: app:"youtube", query:"검색어"
  - 지도: app:"naver_map"|"kakao_map", query:"장소"
  - 음악: app:"spotify"
  - 웹: url:"https://..."
- **앱 내 이동**: target:"schedule"|"growth"|"insights"
- **맛집/카페/장소 추천**: 사용자 위치 정보(📍)가 Context에 있으면 반드시 활용하세요.
  - 위치 정보가 있을 때: "근처 카페" → 사용자 도시/동네 기반으로 구체적 추천 + 지도 앱 query에 동네명 포함
  - 위치 없이 "근처" 요청 시: 어느 지역인지 물어보세요
  - 지도 앱 open_link에 동네명을 포함하면 더 정확한 결과를 보여줍니다 (예: query:"강남역 카페" 대신 query:"사용자동네 카페")
- **일정 추천 시 (필수)**: Context에 사용자 일정 패턴이 있으면 반드시 활용하세요.
  - 휴식 추천: 사용자가 실제로 해온 휴식 활동을 기반으로 추천 (예: 사용자가 주로 산책으로 휴식하면 산책 추천)
  - 시간대: 해당 카테고리를 사용자가 주로 하는 시간대에 맞춰 추천
  - 요일: 사용자의 바쁜/여유로운 요일 패턴을 고려
  - 완료율 높은 활동을 우선 추천 (실행 가능성 높음)
  - 사용자가 한 번도 해보지 않은 활동보다 익숙한 활동 위주로 추천
  - add_schedule 액션으로 바로 일정에 추가할 수 있게 제공`,

        goal: `## 행동 가이드
- **목표 조회**: "목표 보여줘/진행상황 어때" → show_goals
- **시간 분석**: "시간 분석해줘" → show_analysis
- **성장 기록**: "오늘 배운 거/깨달은 점 저장" → save_learning`,

        analysis: `## 행동 가이드
- **시간 분석**: show_analysis (analysisType 필수)
- **목표 조회**: show_goals
- **성장 기록**: save_learning`,

        settings: `## 행동 가이드
- **즉시 실행**: 설정 변경 요청 → 바로 update_settings 액션에 포함. 확인 질문 금지.
- **카테고리 분류**:
  - 글자 크기/컴팩트 모드/애니메이션 → category: "appearance"
  - 알림 소리/진동/브리핑/리마인더 → category: "notifications"
  - 응답 스타일/학습 난이도/자동 제안 → category: "ai"
- **부분 업데이트**: 변경 요청된 설정만 settings에 포함. 나머지는 생략.
- **값 매핑**:
  - 크게/키워줘 → "large", 보통/기본 → "medium", 작게/줄여줘 → "small"
  - 켜줘/활성화 → true, 꺼줘/비활성화 → false
  - 간결하게/짧게 → "concise", 균형있게/보통 → "balanced", 상세하게/자세하게 → "detailed"
  - 쉽게 → "easy", 적당히 → "moderate", 어렵게/도전적 → "challenging"
- **확인 메시지**: "~으로 변경했어요" 형태로 변경 내용을 명확히 알려주세요.`,

        chat: `## 행동 가이드
- 일정 관련 요청이 섞여 있으면 바로 actions에 포함
- 설정 변경 요청이 섞여 있으면 바로 update_settings 액션에 포함
- 일상 대화에는 actions 빈 배열 OK
- **트렌드 브리핑 추천 요청 시**: Context에 있는 트렌드 브리핑 목록에서만 골라 소개하세요. 목록에 없는 브리핑을 만들어내지 마세요. open_briefing 액션의 briefingId는 목록의 ID 문자열을 그대로 사용하세요. 웹 검색(web_search)을 하지 마세요.
- **일정 추천 요청 시**: Context에 사용자 일정 패턴이 있으면 반드시 활용하세요. 사용자의 실제 생활 습관(자주 하는 활동, 선호 시간대, 완료율)을 기반으로 개인화된 추천을 하고, add_schedule 액션으로 바로 추가할 수 있게 제공하세요.`,
    };

    return guides[intent];
}

// ============================================
// 의도별 예시 생성
// ============================================

export function getExamplesForIntent(intent: UserIntent, currentDate: string): string {
    // 내일 날짜 계산 (예시용)
    const [y, m, d] = currentDate.split('-').map(Number);
    const tomorrowDate = new Date(y, m - 1, d + 1);
    const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

    if (intent === 'schedule') {
        return `## Examples
User: "오후 3시에 헬스장에서 운동 잡아줘"
{"message": "오후 3시 운동 추가했어요! 💪", "actions": [{"type": "add_schedule", "label": "운동 추가", "data": {"text": "운동", "startTime": "15:00", "endTime": "16:00", "specificDate": "${currentDate}", "daysOfWeek": null, "color": "primary", "location": "헬스장", "memo": ""}}]}

User: "내일 5시에 기상 잡아줘"
{"message": "내일 오전 5시 기상 일정 추가했어요! ☀️", "actions": [{"type": "add_schedule", "label": "기상 추가", "data": {"text": "기상", "startTime": "05:00", "endTime": "06:00", "specificDate": "${tomorrowStr}", "daysOfWeek": null, "color": "primary", "location": "", "memo": ""}}]}

User: "매일 아침 9시 기상 삭제해줘"
{"message": "매일 오전 9시 기상 일정 삭제했어요!", "actions": [{"type": "delete_schedule", "label": "기상 삭제", "data": {"text": "기상", "startTime": "09:00", "isRepeating": true}}]}

User: "내일 3시 운동 삭제해줘"
{"message": "내일 오후 3시 운동 일정 삭제했어요!", "actions": [{"type": "delete_schedule", "label": "운동 삭제", "data": {"text": "운동", "startTime": "15:00", "specificDate": "${tomorrowStr}"}}]}

User: "내일 운동 시간 4시로 바꿔줘"
{"message": "내일 운동 시간을 오후 4시로 변경했어요! 💪", "actions": [{"type": "update_schedule", "label": "운동 수정", "data": {"originalText": "운동", "originalTime": "15:00", "specificDate": "${tomorrowStr}", "newStartTime": "16:00", "newEndTime": "17:00"}}]}

User: "매주 목요일 오후 6시에서 8시 토끼발 세션 일정 추가해줘"
{"message": "매주 목요일 오후 6시~8시 토끼발 세션 일정 추가했어요! 🐰", "actions": [{"type": "add_schedule", "label": "토끼발 세션 추가", "data": {"text": "토끼발 세션", "startTime": "18:00", "endTime": "20:00", "specificDate": null, "daysOfWeek": [4], "color": "primary", "location": "", "memo": ""}}]}`;
    }

    if (intent === 'search') {
        return `## Examples
User: "운동 영상 틀어줘"
{"message": "...", "actions": [{"type": "open_link", "label": "🎬 유튜브에서 보기", "data": {"app": "youtube", "query": "홈트레이닝 루틴"}}]}

User: "강남역 근처 카페 찾아줘"
{"message": "...", "actions": [{"type": "open_link", "label": "🗺️ 지도에서 보기", "data": {"app": "naver_map", "query": "강남역 카페"}}]}

User: "근처 맛집 추천해줘" (📍 위치: 성수동)
{"message": "성수동 근처 맛집을 찾아볼게요! 🍽️ 성수동은 트렌디한 레스토랑이 많아서 선택지가 다양할 거예요.", "actions": [{"type": "open_link", "label": "🗺️ 지도에서 보기", "data": {"app": "naver_map", "query": "성수동 맛집"}}]}

User: "오늘 일정 하나 추천해줘" (패턴: 사용자가 주로 저녁에 산책/독서로 휴식)
{"message": "오늘 저녁 산책은 어떠세요? 최근 자주 하시던 활동이라 부담 없이 즐기실 수 있을 거예요 🚶‍♂️", "actions": [{"type": "add_schedule", "label": "산책 추가", "data": {"text": "산책", "startTime": "19:00", "endTime": "19:30", "specificDate": "${currentDate}", "daysOfWeek": null, "color": "primary", "location": "", "memo": ""}}]}`;
    }

    if (intent === 'settings') {
        return `## Examples
User: "글자 크기 크게 해줘"
{"message": "글자 크기를 '크게'로 변경했어요! 📝", "actions": [{"type": "update_settings", "label": "글자 크기 변경", "data": {"category": "appearance", "settings": {"fontSize": "large"}}}]}

User: "알림 소리 꺼줘"
{"message": "알림 소리를 꺼드렸어요. 🔇", "actions": [{"type": "update_settings", "label": "알림 소리 끄기", "data": {"category": "notifications", "settings": {"soundEnabled": false}}}}]}

User: "응답 스타일을 간결하게 바꿔줘"
{"message": "응답 스타일을 '간결하게'로 변경했어요! ⚡", "actions": [{"type": "update_settings", "label": "응답 스타일 변경", "data": {"category": "ai", "settings": {"responseStyle": "concise"}}}]}`;
    }

    return '';
}

// ============================================
// 일정 충돌 감지
// ============================================

interface ExistingSchedule {
    text: string;
    startTime?: string;
    endTime?: string;
    completed?: boolean;
    skipped?: boolean;
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
}

function detectConflicts(
    newAction: ChatAction,
    existingSchedules: ExistingSchedule[]
): ExistingSchedule[] {
    if (newAction.type !== 'add_schedule' || !newAction.data?.startTime) return [];

    const newStart = timeToMinutes(newAction.data.startTime);
    const newEnd = newAction.data.endTime
        ? timeToMinutes(newAction.data.endTime)
        : newStart + 60; // 기본 1시간

    return existingSchedules.filter(s => {
        if (s.completed || s.skipped || !s.startTime) return false;
        const existStart = timeToMinutes(s.startTime);
        const existEnd = s.endTime ? timeToMinutes(s.endTime) : existStart + 60;
        // 시간 겹침: newStart < existEnd && newEnd > existStart
        return newStart < existEnd && newEnd > existStart;
    });
}

const BUFFER_MINUTES = 10;

function detectBackToBack(
    newAction: ChatAction,
    existingSchedules: ExistingSchedule[]
): ExistingSchedule | null {
    if (newAction.type !== 'add_schedule' || !newAction.data?.startTime) return null;

    const newStart = timeToMinutes(newAction.data.startTime);
    const newEnd = newAction.data.endTime
        ? timeToMinutes(newAction.data.endTime)
        : newStart + 60;

    for (const s of existingSchedules) {
        if (s.completed || s.skipped || !s.startTime) continue;
        const existStart = timeToMinutes(s.startTime);
        const existEnd = s.endTime ? timeToMinutes(s.endTime) : existStart + 60;

        // 이전 일정 끝 → 새 일정 시작 사이 간격이 BUFFER_MINUTES 미만
        const gapAfterExisting = newStart - existEnd;
        if (gapAfterExisting >= 0 && gapAfterExisting < BUFFER_MINUTES) {
            return s;
        }
        // 새 일정 끝 → 다음 일정 시작 사이 간격이 BUFFER_MINUTES 미만
        const gapBeforeExisting = existStart - newEnd;
        if (gapBeforeExisting >= 0 && gapBeforeExisting < BUFFER_MINUTES) {
            return s;
        }
    }
    return null;
}

// ============================================
// 집중 모드 권장 감지
// ============================================

const FOCUS_KEYWORDS = [...FOCUS_KEYWORDS_CONST];

function isFocusWorthy(text: string): boolean {
    const lower = text.toLowerCase();
    return FOCUS_KEYWORDS.some(kw => lower.includes(kw));
}

// ============================================
// 액션 후처리 (LLM 응답 정규화)
// ============================================

export function postProcessActions(
    actions: ChatAction[],
    currentTime: string,
    existingSchedules?: ExistingSchedule[]
): { actions: ChatAction[]; conflictWarning: string | null; focusSuggestion: string | null } {
    let conflictWarning: string | null = null;
    let focusSuggestion: string | null = null;

    const processed = actions.map(action => {
        if (action.type === "update_settings" && action.data) {
            const validCategories = ['appearance', 'notifications', 'ai'];
            if (!validCategories.includes(action.data.category)) {
                return null;
            }
            const s = action.data.settings;
            if (!s || typeof s !== 'object') return null;
            if (s.fontSize && !['small', 'medium', 'large'].includes(s.fontSize)) delete s.fontSize;
            if (s.responseStyle && !['concise', 'balanced', 'detailed'].includes(s.responseStyle)) delete s.responseStyle;
            if (s.learningDifficulty && !['easy', 'moderate', 'challenging'].includes(s.learningDifficulty)) delete s.learningDifficulty;
            if (Object.keys(s).length === 0) return null;
        }
        if (action.type === "add_schedule" && action.data) {
            if (action.data.text) {
                action.data.text = normalizeScheduleName(action.data.text);
            }
            // specificDate/daysOfWeek 둘 다 없으면 오늘 날짜로 fallback
            const todayFallback = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
            if (!action.data.specificDate && (!action.data.daysOfWeek || action.data.daysOfWeek.length === 0)) {
                action.data.specificDate = todayFallback;
            }
            // daysOfWeek가 빈 배열이면 null로 정리
            if (action.data.daysOfWeek && action.data.daysOfWeek.length === 0) {
                action.data.daysOfWeek = null;
            }
            // 반복 일정에 startDate/endDate 자동 설정 (이번 주 ~ 6개월)
            if (action.data.daysOfWeek && action.data.daysOfWeek.length > 0) {
                const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
                const todayDay = today.getDay();
                // startDate: 이번 주의 첫 번째 해당 요일 (오늘 포함)
                if (!action.data.startDate) {
                    const minDay = Math.min(...action.data.daysOfWeek);
                    const daysUntil = (minDay - todayDay + 7) % 7;
                    const start = new Date(today);
                    start.setDate(start.getDate() + daysUntil);
                    action.data.startDate = start.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
                }
                // endDate: 6개월 후
                if (!action.data.endDate) {
                    const end = new Date(today);
                    end.setMonth(end.getMonth() + 6);
                    action.data.endDate = end.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
                }
            }
            if (action.data.startTime && currentTime) {
                // 내일/미래 일정이면 AM/PM 추론 + 과거 시간 조정 스킵
                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
                const isToday = !action.data.specificDate || action.data.specificDate === todayStr;
                const adjusted = validateAndAdjustTime(action.data.startTime, currentTime, isToday);
                if (adjusted === "") {
                    return null;
                }
                if (adjusted !== action.data.startTime) {
                    action.data.startTime = adjusted;
                }
            }
            // startTime HH:MM 형식 검증
            if (action.data.startTime && !/^\d{2}:\d{2}$/.test(action.data.startTime)) {
                const m = action.data.startTime.match(/(\d{1,2}):?(\d{2})?/);
                if (m) {
                    const h = Math.min(parseInt(m[1], 10), 23);
                    const min = m[2] ? Math.min(parseInt(m[2], 10), 59) : 0;
                    action.data.startTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                }
            }
            // endTime 검증: HH:MM 형식 + startTime보다 이후
            if (action.data.endTime) {
                if (!/^\d{2}:\d{2}$/.test(action.data.endTime)) {
                    const m = action.data.endTime.match(/(\d{1,2}):?(\d{2})?/);
                    if (m) {
                        const h = Math.min(parseInt(m[1], 10), 23);
                        const min = m[2] ? Math.min(parseInt(m[2], 10), 59) : 0;
                        action.data.endTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                    }
                }
                if (action.data.startTime && action.data.endTime <= action.data.startTime) {
                    // endTime이 startTime보다 이전이면 +1시간 보정
                    const [sh] = action.data.startTime.split(':').map(Number);
                    const eh = Math.min(sh + 1, 23);
                    action.data.endTime = `${String(eh).padStart(2, '0')}:${action.data.startTime.split(':')[1]}`;
                }
            }
            // endTime 누락 시 startTime + 1시간
            if (action.data.startTime && !action.data.endTime) {
                const [sh, sm] = action.data.startTime.split(':').map(Number);
                const eh = Math.min(sh + 1, 23);
                action.data.endTime = `${String(eh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
            }
            // 충돌 및 버퍼 감지
            if (existingSchedules && existingSchedules.length > 0) {
                const conflicts = detectConflicts(action, existingSchedules);
                if (conflicts.length > 0) {
                    const conflictNames = conflicts.map(c => `${c.startTime} ${c.text}`).join(', ');
                    conflictWarning = `⚠️ 시간이 겹치는 일정이 있어요: ${conflictNames}`;
                } else {
                    const adjacent = detectBackToBack(action, existingSchedules);
                    if (adjacent) {
                        conflictWarning = `💡 "${adjacent.text}" 일정과 연속이에요. 사이에 여유 시간을 두는 건 어떨까요?`;
                    }
                }
            }
            // 집중 모드 권장은 일정 시작 시 schedule-reminder cron에서 처리
            // (일정 추가 시점에 물어보면 시간대가 맞지 않으므로 제거)
        }
        return action;
    }).filter(Boolean) as ChatAction[];

    return { actions: processed, conflictWarning, focusSuggestion };
}

// ============================================
// 컨텍스트 블록 크기 제어
// ============================================

function truncateBlock(block: string, maxChars: number): string {
    if (block.length <= maxChars) return block;
    return block.slice(0, maxChars) + '\n... (이하 생략)';
}

const BLOCK_CHAR_LIMITS: Record<string, number> = {
    scheduleContext: 2000,
    eventLogsContext: 3000,
    ragContext: 1500,
    schedulePatternContext: 1500,
    goalsContext: 1000,
    learningContext: 1000,
    trendContext: 1000,
    pendingScheduleContext: 1000,
    locationContext: 500,
};

// ============================================
// 컨텍스트 블록 조립
// ============================================

export function assembleContextBlocks(params: {
    intent: UserIntent;
    currentDateContext: string;
    userContext: string;
    scheduleContext: string;
    eventLogsContext: string;
    ragContext: string;
    trendContext: string;
    pendingScheduleContext: string;
    locationContext?: string;
    goalsContext?: string;
    learningContext?: string;
    schedulePatternContext?: string;
}): string[] {
    const blocks: string[] = [];

    // 항상 포함: 날짜/시간, 사용자 기본 정보
    blocks.push(params.currentDateContext);
    blocks.push(params.userContext);

    // settings 의도는 최소 컨텍스트만 (날짜+사용자 정보)
    if (params.intent === 'settings') {
        return blocks;
    }

    // 일정: schedule/chat만 전체, 나머지는 개수 요약
    if (params.intent === 'schedule' || params.intent === 'chat') {
        blocks.push(truncateBlock(params.scheduleContext, BLOCK_CHAR_LIMITS.scheduleContext));
    } else if (params.scheduleContext) {
        const scheduleCount = (params.scheduleContext.match(/^- /gm) || []).length;
        if (scheduleCount > 0) {
            blocks.push(`오늘 일정 ${scheduleCount}개 등록됨 (상세는 생략).`);
        }
    }

    // Max 전용: 관련 의도에서만
    if (params.eventLogsContext && (params.intent === 'schedule' || params.intent === 'analysis' || params.intent === 'goal')) {
        blocks.push(truncateBlock(params.eventLogsContext, BLOCK_CHAR_LIMITS.eventLogsContext));
    }
    if (params.ragContext) {
        blocks.push(truncateBlock(params.ragContext, BLOCK_CHAR_LIMITS.ragContext));
    }

    // 트렌드: chat/search만
    if (params.trendContext && (params.intent === 'chat' || params.intent === 'search')) {
        blocks.push(truncateBlock(params.trendContext, BLOCK_CHAR_LIMITS.trendContext));
    }

    // 펜딩 일정: 항상 (있을 때만)
    if (params.pendingScheduleContext) {
        blocks.push(truncateBlock(params.pendingScheduleContext, BLOCK_CHAR_LIMITS.pendingScheduleContext));
    }

    // 위치 컨텍스트: search/chat에서 장소 추천에 활용
    if (params.locationContext) {
        blocks.push(truncateBlock(params.locationContext, BLOCK_CHAR_LIMITS.locationContext));
    }

    // 목표 컨텍스트: goal/chat/analysis 의도에서 활용
    if (params.goalsContext && (params.intent === 'goal' || params.intent === 'chat' || params.intent === 'analysis')) {
        blocks.push(truncateBlock(params.goalsContext, BLOCK_CHAR_LIMITS.goalsContext));
    }

    // 학습 컨텍스트: chat/analysis 의도에서 활용
    if (params.learningContext && (params.intent === 'chat' || params.intent === 'analysis')) {
        blocks.push(truncateBlock(params.learningContext, BLOCK_CHAR_LIMITS.learningContext));
    }

    // 일정 패턴 컨텍스트: search/chat 의도에서 추천 시 활용
    if (params.schedulePatternContext && (params.intent === 'search' || params.intent === 'chat')) {
        blocks.push(truncateBlock(params.schedulePatternContext, BLOCK_CHAR_LIMITS.schedulePatternContext));
    }

    return blocks;
}

// ============================================
// Max 플랜 전용 고맥락 응답 가이드 (정적 상수)
// ============================================

const MAX_PLAN_GUIDE = `
## 고맥락 응답 가이드 (자비스 모드)

🎯 핵심 원칙: "조언(Advice) < 전략적 판단(Strategic Judgment) + 실행(Action)"

1. **일정 연쇄 관리**: 일정 하나가 아닌 연쇄(체인)로 관리. 충돌/간격은 자동 조정 후 보고. "~하세요" 대신 "~했습니다" 완료형.
2. **인과관계 설명**: "내일 [시간]에 [일정]이 있어 [X]시간 수면 확보" 식으로 연결.
3. **뻔한 조언 금지**: "카페인 피하세요" 대신 "방해 금지 모드를 켤까요?" 등 실질적 제안.
4. **성과 요약 보고**: 구체적 수치 포함. "완료율 X%로 지난주 대비 Y% 상승/하락".
5. **참모 역할**: "등록했습니다" → "반영했습니다". "잘 자세요" → "내일 브리핑 준비해두겠습니다".
6. **데이터 기반 인사이트**: 완료율 추이, 카테고리별 성과, 벤치마크 제공.
`;

// ============================================
// 시스템 프롬프트 조립
// ============================================

export function buildSystemPrompt(params: {
    intent: UserIntent;
    userPlan: string;
    contextBlocks: string[];
    actionSchema: string;
    currentDate: string;
    personaStyle?: string;
}): string {
    const { intent, userPlan, contextBlocks, actionSchema, currentDate, personaStyle } = params;

    // 페르소나 스타일 기반 응답 스타일 결정 (라벨은 persona.ts 중앙 관리)
    const effectiveStyle = (personaStyle === 'professional' || (userPlan === "Max" && personaStyle !== 'friendly'))
        ? 'professional' : (personaStyle === 'brief' ? 'brief' : 'friendly');
    const styleConfig: Record<string, string> = {
        professional: `**${PERSONA_LABELS.professional.name}**: 실행 중심. "~반영했습니다" 완료형. 간결하게 2-3문장. 이모지 최소화. 데이터/수치 포함.`,
        brief: `**${PERSONA_LABELS.brief.name}**: 핵심만 전달. 2문장 이내. 이모지 사용 안 함. 인사말/감탄사 최소화.`,
        friendly: `**${PERSONA_LABELS.friendly.name}**: 부드러운 존댓말. 2-3문장. 이모지 1-2개로 친근하게. 액션 실행 시 완료형("~했어요/~할게요"), 제안 시 "~할까요?/~어때요?".`,
    };
    const responseStyle = styleConfig[effectiveStyle];

    const prompt = `# Fi.eri AI Assistant

## Context
${contextBlocks.join('\n')}

## Response Style
${responseStyle}
${getResponseLengthGuide(intent)}

## Core Rules
1. **즉시 실행**: 요청 → 바로 actions에 포함. 불필요한 질문 금지.
2. **완료형 어미**: actions에 실행 동작이 포함되면 message는 완료형으로 작성. "추가했어요/삭제했어요/변경했어요" (O), "추가해드릴게요/삭제해드릴게요" (X). 액션이 곧 실행이므로 미래형 금지.
3. **자연스러운 확인**: "오후 3시 운동 추가했어요!" 처럼 핵심(시간+이름+동작)만 간결하게. 불필요한 장식 금지. 시간은 일정의 시각을 나타내므로 "~에 삭제/추가" (X, 동작 시점으로 오해) → "~ 일정 삭제/추가했어요" (O). 예: "오전 11시 10분 아침 루틴 삭제했어요!" (O), "오전 11시 10분에 삭제해드릴게요" (X).
4. **휴식 존중**: 여가 일정 앞에서 생산성 조언 금지.
5. **시간 제약**: 오늘 일정만 현재 시간 이후. 내일/미래는 제약 없음.
6. 항상 **1인칭 시점**으로 직접 말하세요 ("Fi.eri가~" 같은 3인칭 금지)
7. 반드시 한국어로만 응답하세요
8. **반드시 존댓말(해요체/합쇼체)을 사용하세요.** 반말 절대 금지. 올바른 문법을 지키세요.

## Action Schema
\`\`\`typescript
${actionSchema}
\`\`\`

${getBehaviorGuide(intent)}

${getExamplesForIntent(intent, currentDate)}

**CRITICAL**: 요청에 실행할 동작이 있으면 반드시 actions에 포함!

${userPlan === 'Max' ? MAX_PLAN_GUIDE : ''}

${SAFETY_SYSTEM_RULES}

**OUTPUT**: 반드시 JSON 형식으로만 응답하세요. { "message": "...", "actions": [...] }`;

    if (prompt.length > 15000) {
        logger.warn(`[ChatUtils] System prompt very large: ${prompt.length} chars (intent: ${intent})`);
    }

    return prompt;
}

// ============================================
// 의도별 응답 길이 프롬프트 가이드
// ============================================

function getResponseLengthGuide(intent: UserIntent): string {
    const guides: Record<UserIntent, string> = {
        schedule: '**응답 길이**: message는 1-2문장으로 짧게. 핵심 확인만. 절대 3문장 넘기지 마세요.',
        settings: '**응답 길이**: message는 1문장. 변경 완료 확인만. 설명 불필요.',
        search: '**응답 길이**: message는 2-3문장. 검색 결과 요약만 간결하게.',
        goal: '**응답 길이**: message는 3-4문장 이내. 수치와 핵심 인사이트만.',
        analysis: '**응답 길이**: message는 3-5문장 이내. 데이터 기반 요약만.',
        chat: '**응답 길이**: message는 2-4문장. 자연스럽되 간결하게.',
    };
    return guides[intent];
}

// ============================================
// 의도별 필요한 데이터 조회 결정
// ============================================

export function getRequiredDataSources(intent: UserIntent, userPlan: string): {
    needsEventLogs: boolean;
    needsRag: boolean;
    needsTrend: boolean;
    needsFullSchedule: boolean;
} {
    return {
        needsEventLogs: userPlan === "Max" && ['schedule', 'analysis', 'goal'].includes(intent),
        needsRag: ['chat', 'analysis', 'goal', 'search'].includes(intent),
        needsTrend: ['chat', 'search'].includes(intent),
        needsFullSchedule: ['schedule', 'chat'].includes(intent),
    };
}
