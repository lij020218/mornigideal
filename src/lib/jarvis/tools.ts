/**
 * Jarvis Tool Definitions
 * ReAct 에이전트가 사용할 수 있는 도구 인터페이스 및 레지스트리
 */

import { PlanType } from '@/types/jarvis';

export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    description: string;
    required: boolean;
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: ToolParameter[];
    requiresConfirmation: boolean;
    planGate: PlanType[];
}

export interface ToolCall {
    toolName: string;
    arguments: Record<string, any>;
}

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    humanReadableSummary: string;
}

export const TOOL_REGISTRY: ToolDefinition[] = [
    // === 일정 조회 ===
    {
        name: 'get_today_schedules',
        description: '오늘의 일정 목록을 조회합니다',
        parameters: [],
        requiresConfirmation: false,
        planGate: ['Free', 'Pro', 'Max'],
    },
    {
        name: 'get_schedule_by_date',
        description: '특정 날짜의 일정을 조회합니다',
        parameters: [
            { name: 'date', type: 'string', description: 'YYYY-MM-DD 형식', required: true },
        ],
        requiresConfirmation: false,
        planGate: ['Free', 'Pro', 'Max'],
    },

    // === 일정 관리 ===
    {
        name: 'add_schedule',
        description: '새 일정을 추가합니다',
        parameters: [
            { name: 'text', type: 'string', description: '일정 이름', required: true },
            { name: 'startTime', type: 'string', description: 'HH:MM 형식', required: true },
            { name: 'endTime', type: 'string', description: 'HH:MM 형식', required: false },
            { name: 'specificDate', type: 'string', description: 'YYYY-MM-DD (특정 날짜)', required: false },
            { name: 'daysOfWeek', type: 'object', description: '반복 요일 배열 [0=일~6=토]', required: false },
            { name: 'location', type: 'string', description: '장소', required: false },
            { name: 'memo', type: 'string', description: '메모', required: false },
        ],
        requiresConfirmation: false,
        planGate: ['Free', 'Pro', 'Max'],
    },
    {
        name: 'delete_schedule',
        description: '일정을 삭제합니다',
        parameters: [
            { name: 'text', type: 'string', description: '일정 이름', required: true },
            { name: 'startTime', type: 'string', description: 'HH:MM', required: true },
            { name: 'isRepeating', type: 'boolean', description: '반복 일정 여부', required: false },
        ],
        requiresConfirmation: true,
        planGate: ['Free', 'Pro', 'Max'],
    },
    {
        name: 'update_schedule',
        description: '기존 일정을 수정합니다',
        parameters: [
            { name: 'originalText', type: 'string', description: '원래 일정 이름', required: true },
            { name: 'originalTime', type: 'string', description: '원래 시간 HH:MM', required: true },
            { name: 'newText', type: 'string', description: '새 이름', required: false },
            { name: 'newStartTime', type: 'string', description: '새 시간 HH:MM', required: false },
        ],
        requiresConfirmation: true,
        planGate: ['Free', 'Pro', 'Max'],
    },

    // === 검색/지식 ===
    {
        name: 'web_search',
        description: '웹 검색을 수행합니다',
        parameters: [
            { name: 'query', type: 'string', description: '검색 쿼리', required: true },
        ],
        requiresConfirmation: false,
        planGate: ['Free', 'Pro', 'Max'],
    },
    {
        name: 'search_user_memory',
        description: '사용자의 과거 대화/메모에서 관련 정보를 검색합니다 (RAG)',
        parameters: [
            { name: 'query', type: 'string', description: '검색 쿼리', required: true },
        ],
        requiresConfirmation: false,
        planGate: ['Max'],
    },

    // === 상태/컨텍스트 조회 ===
    {
        name: 'get_user_state',
        description: '사용자의 현재 상태 (에너지, 스트레스, 집중력 등)를 조회합니다',
        parameters: [],
        requiresConfirmation: false,
        planGate: ['Pro', 'Max'],
    },
    {
        name: 'get_goals',
        description: '사용자의 장기 목표를 조회합니다',
        parameters: [
            { name: 'goalType', type: 'string', description: 'weekly | monthly | yearly | all', required: false },
        ],
        requiresConfirmation: false,
        planGate: ['Free', 'Pro', 'Max'],
    },
    {
        name: 'get_schedule_patterns',
        description: '사용자의 일정 패턴 (바쁜 요일, 자유시간, 루틴 등)을 분석합니다',
        parameters: [],
        requiresConfirmation: false,
        planGate: ['Pro', 'Max'],
    },

    // === 액션 실행 ===
    {
        name: 'create_checklist',
        description: '준비 체크리스트를 생성합니다',
        parameters: [
            { name: 'title', type: 'string', description: '체크리스트 제목', required: true },
            { name: 'items', type: 'object', description: '항목 문자열 배열', required: true },
            { name: 'scheduleId', type: 'string', description: '관련 일정 ID', required: false },
        ],
        requiresConfirmation: false,
        planGate: ['Pro', 'Max'],
    },
    {
        name: 'save_learning',
        description: '학습 인사이트나 메모를 저장합니다',
        parameters: [
            { name: 'content', type: 'string', description: '저장할 내용', required: true },
            { name: 'category', type: 'string', description: 'insight | skill | reflection | goal_progress', required: true },
        ],
        requiresConfirmation: false,
        planGate: ['Free', 'Pro', 'Max'],
    },

    // === 일정 준비 ===
    {
        name: 'prepare_schedule',
        description: '다가오는 중요 일정에 대한 준비 체크리스트를 생성합니다',
        parameters: [
            { name: 'scheduleText', type: 'string', description: '일정 이름', required: true },
            { name: 'startTime', type: 'string', description: '일정 시작 시간 HH:MM', required: true },
        ],
        requiresConfirmation: false,
        planGate: ['Pro', 'Max'],
    },

    // === 일정 추천 ===
    {
        name: 'suggest_schedule',
        description: '사용자의 현재 상태(스트레스, 에너지, 업무-휴식 균형, 일정 패턴)를 분석하여 맞춤 일정을 추천합니다',
        parameters: [
            { name: 'count', type: 'number', description: '추천 개수 (기본 3)', required: false },
            { name: 'focus', type: 'string', description: '집중 영역: rest | productivity | exercise | learning | auto (기본 auto)', required: false },
        ],
        requiresConfirmation: false,
        planGate: ['Free', 'Pro', 'Max'],
    },

    // === 최종 응답 (루프 종료) ===
    {
        name: 'respond_to_user',
        description: '사용자에게 최종 응답을 전달합니다. 이 도구를 호출하면 에이전트 루프가 종료됩니다.',
        parameters: [
            { name: 'message', type: 'string', description: '사용자에게 보여줄 메시지 (한국어)', required: true },
            { name: 'actions', type: 'object', description: '프론트엔드 액션 버튼 배열 (선택)', required: false },
        ],
        requiresConfirmation: false,
        planGate: ['Free', 'Pro', 'Max'],
    },
];

/**
 * 사용자 플랜에 따라 사용 가능한 도구 필터링
 */
export function getAvailableTools(userPlan: PlanType): ToolDefinition[] {
    return TOOL_REGISTRY.filter(t => t.planGate.includes(userPlan));
}
