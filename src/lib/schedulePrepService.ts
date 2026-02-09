/**
 * Schedule Prep Assistant
 *
 * 중요 일정 2-3시간 전에 선제적 준비 자료를 생성
 * - 일정 유형(회의/면접/발표/시험/예약)별 체크리스트
 * - Pro/Max: RAG 메모리에서 관련 과거 메모 검색
 */

import { isImportantSchedule } from '@/lib/proactiveNotificationService';

// ============================================
// Types
// ============================================

export type PrepType = 'meeting' | 'interview' | 'presentation' | 'exam' | 'appointment' | 'general';

export interface SchedulePrep {
    scheduleId?: string;
    scheduleName: string;
    prepType: PrepType;
    checklist: string[];
    contextBrief?: string;
    suggestedActions?: string[];
}

// ============================================
// Prep Type Detection
// ============================================

const PREP_TYPE_KEYWORDS: Record<PrepType, string[]> = {
    meeting: ['회의', '미팅', 'meeting', '회견', '간담회', '조회', '보고', '브리핑', '1on1', '1:1'],
    interview: ['면접', '인터뷰', 'interview', '채용', '합격'],
    presentation: ['발표', '프레젠테이션', 'PT', 'presentation', '세미나', '강연', '강의', '워크숍'],
    exam: ['시험', '테스트', 'test', 'exam', '평가', '자격증', '필기', '실기', '모의고사'],
    appointment: ['예약', '진료', '상담', '병원', '치과', '안과', '약속', '미용실', '정비'],
    general: [],
};

function detectPrepType(text: string): PrepType {
    const lowerText = text.toLowerCase();

    for (const [type, keywords] of Object.entries(PREP_TYPE_KEYWORDS)) {
        if (type === 'general') continue;
        if (keywords.some(kw => lowerText.includes(kw))) {
            return type as PrepType;
        }
    }

    return 'general';
}

// ============================================
// Checklist Templates
// ============================================

const CHECKLIST_TEMPLATES: Record<PrepType, string[]> = {
    meeting: [
        '회의 자료/안건 확인',
        '참석자 명단 체크',
        '노트북/태블릿 충전 확인',
        '회의실 장소/링크 확인',
        '핵심 보고 사항 정리 (3줄 요약)',
    ],
    interview: [
        '이력서/포트폴리오 최종 검토',
        '자기소개 연습 (1분/3분)',
        '회사/직무 관련 최신 뉴스 확인',
        '복장 점검',
        '이동 경로 및 소요 시간 확인',
        '면접관에게 물어볼 질문 3가지 준비',
    ],
    presentation: [
        '슬라이드 최종 확인 (오타, 흐름)',
        '발표 리허설 (최소 1회)',
        '리모컨/포인터 테스트',
        '프로젝터/화면공유 연결 확인',
        '핵심 메시지 3개 정리',
        '예상 질문 답변 준비',
    ],
    exam: [
        '핵심 노트/요약 자료 복습',
        '필기구, 신분증, 계산기 등 준비물 확인',
        '시험장 위치 및 이동 경로 확인',
        '충분한 수분/간식 준비',
        '시험 시간 및 유의사항 확인',
    ],
    appointment: [
        '예약 시간 및 장소 확인',
        '필요 서류/준비물 확인',
        '이동 경로 및 소요 시간 확인',
        '사전 전달 사항 정리',
    ],
    general: [
        '일정 시간 및 장소 확인',
        '필요한 준비물 확인',
        '관련 자료 검토',
    ],
};

// ============================================
// Core Functions
// ============================================

/**
 * 2-3시간 이내 중요 일정 필터링
 */
export function detectPrepWorthy(
    schedules: any[],
    currentTime: Date
): any[] {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    return schedules.filter(s => {
        if (!s.startTime) return false;

        // 중요 일정 키워드 체크
        const isImportant = isImportantSchedule(s.text);
        const prepType = detectPrepType(s.text);
        if (!isImportant && prepType === 'general') return false;

        // 시간 차이 계산: 120~180분 사이
        const [h, m] = s.startTime.split(':').map(Number);
        const scheduleMinutes = h * 60 + m;
        const diff = scheduleMinutes - currentMinutes;

        return diff >= 120 && diff <= 180;
    });
}

/**
 * 일정 준비 자료 생성
 */
export async function generatePrep(
    schedule: any,
    userEmail?: string,
    userPlan?: string
): Promise<SchedulePrep> {
    const prepType = detectPrepType(schedule.text);
    const checklist = [...CHECKLIST_TEMPLATES[prepType]];

    // 장소가 있으면 이동 관련 체크리스트 강조
    if (schedule.location) {
        checklist.unshift(`장소: ${schedule.location} - 이동 경로 확인`);
    }

    let contextBrief: string | undefined;

    // Pro/Max: RAG 메모리에서 관련 과거 메모 검색
    if (userEmail && (userPlan === 'Pro' || userPlan === 'Max')) {
        try {
            const { getRelevantContext } = await import('@/lib/jarvis-memory');
            const context = await getRelevantContext(userEmail, schedule.text);
            if (context) {
                contextBrief = context.substring(0, 300);
            }
        } catch {
            // RAG 실패는 무시
        }
    }

    const suggestedActions = getSuggestedActions(prepType, schedule);

    return {
        scheduleId: schedule.id,
        scheduleName: schedule.text,
        prepType,
        checklist,
        contextBrief,
        suggestedActions,
    };
}

/**
 * 프로액티브 알림 형태로 포맷
 */
export function formatPrepNotification(prep: SchedulePrep): {
    id: string;
    type: 'schedule_prep';
    priority: 'medium';
    title: string;
    message: string;
    actionType: string;
    actionPayload: Record<string, any>;
} {
    const typeEmoji: Record<PrepType, string> = {
        meeting: '💼',
        interview: '👔',
        presentation: '📊',
        exam: '📝',
        appointment: '📌',
        general: '📋',
    };

    const typeLabel: Record<PrepType, string> = {
        meeting: '회의',
        interview: '면접',
        presentation: '발표',
        exam: '시험',
        appointment: '예약',
        general: '일정',
    };

    const emoji = typeEmoji[prep.prepType];
    const label = typeLabel[prep.prepType];

    return {
        id: `schedule-prep-${prep.scheduleId || Date.now()}`,
        type: 'schedule_prep',
        priority: 'medium',
        title: `${emoji} ${label} 준비 알림`,
        message: `"${prep.scheduleName}" ${label}이(가) 곧 시작됩니다.\n\n체크리스트:\n${prep.checklist.map(c => `☐ ${c}`).join('\n')}`,
        actionType: 'view_prep',
        actionPayload: {
            prep,
            scheduleText: prep.scheduleName,
        },
    };
}

// ============================================
// Helper Functions
// ============================================

function getSuggestedActions(prepType: PrepType, schedule: any): string[] {
    const actions: string[] = [];

    switch (prepType) {
        case 'meeting':
            actions.push('회의 안건 작성하기');
            actions.push('참석자에게 리마인더 보내기');
            break;
        case 'interview':
            actions.push('자기소개 녹음해서 들어보기');
            actions.push('회사 최근 뉴스 검색');
            break;
        case 'presentation':
            actions.push('발표 타이머 설정하기');
            actions.push('핵심 키워드 메모 준비');
            break;
        case 'exam':
            actions.push('오답노트 복습');
            actions.push('시험 팁 검색');
            break;
        case 'appointment':
            actions.push('지도에서 경로 확인');
            break;
        default:
            actions.push('관련 자료 검토하기');
    }

    return actions;
}
