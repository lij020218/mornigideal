/**
 * Task Priority Scoring Service - Pokey 스타일
 *
 * Impact + Effort = Leverage 공식으로 우선순위 자동 계산
 * P0 (긴급) → P5 (낮음) 티어 분류
 */

export interface TaskPriority {
    priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
    impact: number; // 1-5
    effort: number; // 1-5
    leverage: number; // impact / effort
    reasoning: string;
}

// 키워드 기반 Impact 점수 계산
const HIGH_IMPACT_KEYWORDS = [
    '마감', 'deadline', '발표', '미팅', '회의', 'meeting',
    '면접', '시험', '테스트', '프레젠테이션', '중요',
    '긴급', 'urgent', '필수', '클라이언트', '고객'
];

const MEDIUM_IMPACT_KEYWORDS = [
    '보고서', '리뷰', '검토', '계획', '준비',
    '업무', '작업', '프로젝트', '개발', '코딩'
];

const LOW_IMPACT_KEYWORDS = [
    '정리', '청소', '이메일', '메일', '확인',
    '운동', '휴식', '산책', '독서'
];

// 키워드 기반 Effort 점수 계산
const HIGH_EFFORT_KEYWORDS = [
    '프로젝트', '개발', '구현', '설계', '발표',
    '보고서', '논문', '분석', '리서치'
];

const MEDIUM_EFFORT_KEYWORDS = [
    '미팅', '회의', '리뷰', '검토', '수정',
    '업데이트', '작성'
];

const LOW_EFFORT_KEYWORDS = [
    '확인', '이메일', '전화', '정리', '청소',
    '산책', '휴식', '식사'
];

/**
 * 텍스트에서 Impact 점수 계산
 */
function calculateImpact(text: string, deadline?: Date | null): number {
    const lowerText = text.toLowerCase();
    let score = 3; // 기본 중간값

    // 키워드 기반 점수 조정
    if (HIGH_IMPACT_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))) {
        score = 5;
    } else if (MEDIUM_IMPACT_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))) {
        score = 4;
    } else if (LOW_IMPACT_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))) {
        score = 2;
    }

    // 마감일이 가까우면 Impact 증가
    if (deadline) {
        const daysUntilDeadline = Math.ceil(
            (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilDeadline <= 1) score = Math.min(5, score + 2);
        else if (daysUntilDeadline <= 3) score = Math.min(5, score + 1);
    }

    return Math.max(1, Math.min(5, score));
}

/**
 * 텍스트에서 Effort 점수 계산
 */
function calculateEffort(text: string, duration?: number): number {
    const lowerText = text.toLowerCase();
    let score = 3; // 기본 중간값

    // 키워드 기반 점수 조정
    if (HIGH_EFFORT_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))) {
        score = 5;
    } else if (MEDIUM_EFFORT_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))) {
        score = 3;
    } else if (LOW_EFFORT_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))) {
        score = 1;
    }

    // 소요 시간 기반 조정 (분 단위)
    if (duration) {
        if (duration >= 180) score = Math.max(score, 5); // 3시간 이상
        else if (duration >= 60) score = Math.max(score, 4); // 1시간 이상
        else if (duration <= 15) score = Math.min(score, 2); // 15분 이하
    }

    return Math.max(1, Math.min(5, score));
}

/**
 * Leverage와 Impact 기반으로 Priority 티어 결정
 */
function determinePriorityTier(impact: number, effort: number, leverage: number): 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' {
    // P0: 긴급 + 높은 임팩트
    if (impact === 5 && leverage >= 2) return 'P0';

    // P1: 높은 임팩트 또는 매우 높은 레버리지
    if (impact >= 4 && leverage >= 1.5) return 'P1';
    if (leverage >= 3) return 'P1';

    // P2: 중간-높은 임팩트
    if (impact >= 4) return 'P2';
    if (leverage >= 2) return 'P2';

    // P3: 중간 임팩트
    if (impact >= 3) return 'P3';
    if (leverage >= 1) return 'P3';

    // P4: 낮은-중간 임팩트
    if (impact >= 2) return 'P4';

    // P5: 낮은 우선순위
    return 'P5';
}

/**
 * 우선순위 이유 생성
 */
function generateReasoning(
    priority: string,
    impact: number,
    effort: number,
    leverage: number
): string {
    const impactDesc = impact >= 4 ? '높음' : impact >= 3 ? '중간' : '낮음';
    const effortDesc = effort >= 4 ? '높음' : effort >= 3 ? '중간' : '낮음';

    if (priority === 'P0') {
        return `긴급! 임팩트(${impactDesc})가 높고 효율적입니다.`;
    }
    if (priority === 'P1') {
        return `중요! 임팩트(${impactDesc}), 노력 대비 효과가 좋습니다.`;
    }
    if (priority === 'P2') {
        return `임팩트(${impactDesc})가 있는 작업입니다.`;
    }
    if (priority === 'P3') {
        return `일반적인 중요도의 작업입니다.`;
    }
    if (priority === 'P4') {
        return `여유 있을 때 처리해도 되는 작업입니다.`;
    }
    return `낮은 우선순위 작업입니다.`;
}

/**
 * 일정/작업의 우선순위 계산
 */
export function calculateTaskPriority(
    text: string,
    options?: {
        deadline?: Date | null;
        duration?: number; // 분 단위
        isRecurring?: boolean;
    }
): TaskPriority {
    const impact = calculateImpact(text, options?.deadline);
    const effort = calculateEffort(text, options?.duration);
    const leverage = Math.round((impact / effort) * 100) / 100;

    const priority = determinePriorityTier(impact, effort, leverage);
    const reasoning = generateReasoning(priority, impact, effort, leverage);

    return {
        priority,
        impact,
        effort,
        leverage,
        reasoning
    };
}

/**
 * 여러 일정을 우선순위로 정렬
 */
export function sortByPriority<T extends { text: string; startTime?: string; endTime?: string }>(
    tasks: T[]
): (T & { priorityInfo: TaskPriority })[] {
    const priorityOrder: Record<string, number> = {
        'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3, 'P4': 4, 'P5': 5
    };

    return tasks
        .map(task => {
            // duration 계산 (있다면)
            let duration: number | undefined;
            if (task.startTime && task.endTime) {
                const [startH, startM] = task.startTime.split(':').map(Number);
                const [endH, endM] = task.endTime.split(':').map(Number);
                duration = (endH * 60 + endM) - (startH * 60 + startM);
            }

            return {
                ...task,
                priorityInfo: calculateTaskPriority(task.text, { duration })
            };
        })
        .sort((a, b) => {
            // 우선순위 티어로 먼저 정렬
            const priorityDiff = priorityOrder[a.priorityInfo.priority] - priorityOrder[b.priorityInfo.priority];
            if (priorityDiff !== 0) return priorityDiff;

            // 같은 티어면 시작 시간으로 정렬
            if (a.startTime && b.startTime) {
                return a.startTime.localeCompare(b.startTime);
            }
            return 0;
        });
}

/**
 * 우선순위 색상 반환
 */
export function getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
        'P0': '#EF4444', // red-500
        'P1': '#F97316', // orange-500
        'P2': '#EAB308', // yellow-500
        'P3': '#22C55E', // green-500
        'P4': '#3B82F6', // blue-500
        'P5': '#6B7280', // gray-500
    };
    return colors[priority] || colors['P5'];
}

/**
 * 우선순위 라벨 반환
 */
export function getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
        'P0': '긴급',
        'P1': '높음',
        'P2': '중요',
        'P3': '보통',
        'P4': '낮음',
        'P5': '여유',
    };
    return labels[priority] || '미정';
}
