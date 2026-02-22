/**
 * 루틴 템플릿 데이터
 * 카테고리별 사전 정의 템플릿
 */

export interface RoutineScheduleItem {
    text: string;
    startTime: string;  // HH:MM
    endTime: string;     // HH:MM
    color: string;
}

export interface RoutineTemplate {
    id: string;
    nameKo: string;
    description: string;
    category: 'developer' | 'student' | 'freelancer' | 'health' | 'general';
    schedules: RoutineScheduleItem[];
    tags: string[];
}

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
    // Developer
    {
        id: 'dev-morning',
        nameKo: '개발자 모닝 루틴',
        description: '집중 코딩 + 학습으로 시작하는 아침',
        category: 'developer',
        schedules: [
            { text: '기상 + 스트레칭', startTime: '07:00', endTime: '07:20', color: '#10B981' },
            { text: '아침 식사', startTime: '07:20', endTime: '07:50', color: '#F59E0B' },
            { text: '코드 리뷰 & PR 확인', startTime: '08:00', endTime: '08:30', color: '#3B82F6' },
            { text: '딥워크 (집중 코딩)', startTime: '08:30', endTime: '10:30', color: '#8B5CF6' },
            { text: '휴식 + 커피', startTime: '10:30', endTime: '10:45', color: '#10B981' },
            { text: '기술 문서/블로그 읽기', startTime: '10:45', endTime: '11:15', color: '#EC4899' },
        ],
        tags: ['개발', '아침형', '집중'],
    },
    {
        id: 'dev-evening',
        nameKo: '개발자 저녁 루틴',
        description: '사이드 프로젝트와 자기계발',
        category: 'developer',
        schedules: [
            { text: '운동 (헬스/러닝)', startTime: '18:30', endTime: '19:30', color: '#10B981' },
            { text: '저녁 식사', startTime: '19:30', endTime: '20:00', color: '#F59E0B' },
            { text: '사이드 프로젝트', startTime: '20:00', endTime: '21:30', color: '#8B5CF6' },
            { text: '온라인 강의 수강', startTime: '21:30', endTime: '22:15', color: '#EC4899' },
            { text: '하루 정리 & 내일 계획', startTime: '22:15', endTime: '22:30', color: '#3B82F6' },
        ],
        tags: ['개발', '저녁', '사이드프로젝트'],
    },
    // Student
    {
        id: 'student-study',
        nameKo: '대학생 공부 루틴',
        description: '포모도로 기반 집중 학습',
        category: 'student',
        schedules: [
            { text: '기상 + 세면', startTime: '07:30', endTime: '08:00', color: '#10B981' },
            { text: '아침 식사', startTime: '08:00', endTime: '08:30', color: '#F59E0B' },
            { text: '1교시 공부 (포모도로 2회)', startTime: '09:00', endTime: '10:00', color: '#3B82F6' },
            { text: '휴식', startTime: '10:00', endTime: '10:15', color: '#10B981' },
            { text: '2교시 공부 (포모도로 2회)', startTime: '10:15', endTime: '11:15', color: '#3B82F6' },
            { text: '점심 식사', startTime: '12:00', endTime: '13:00', color: '#F59E0B' },
            { text: '3교시 공부 (포모도로 3회)', startTime: '14:00', endTime: '15:30', color: '#8B5CF6' },
            { text: '운동/산책', startTime: '16:00', endTime: '17:00', color: '#10B981' },
        ],
        tags: ['학생', '공부', '포모도로'],
    },
    {
        id: 'student-exam',
        nameKo: '시험 기간 루틴',
        description: '시험 대비 집중 모드',
        category: 'student',
        schedules: [
            { text: '기상 + 가벼운 스트레칭', startTime: '06:30', endTime: '07:00', color: '#10B981' },
            { text: '아침 식사', startTime: '07:00', endTime: '07:30', color: '#F59E0B' },
            { text: '핵심 과목 복습', startTime: '08:00', endTime: '10:00', color: '#EF4444' },
            { text: '휴식 + 간식', startTime: '10:00', endTime: '10:20', color: '#10B981' },
            { text: '문제 풀이', startTime: '10:20', endTime: '12:00', color: '#8B5CF6' },
            { text: '점심 + 낮잠', startTime: '12:00', endTime: '13:30', color: '#F59E0B' },
            { text: '약점 과목 집중', startTime: '14:00', endTime: '16:00', color: '#EF4444' },
            { text: '가벼운 산책', startTime: '16:00', endTime: '16:30', color: '#10B981' },
            { text: '복습 + 오답 정리', startTime: '17:00', endTime: '19:00', color: '#3B82F6' },
        ],
        tags: ['학생', '시험', '집중'],
    },
    // Freelancer
    {
        id: 'freelancer-productive',
        nameKo: '프리랜서 생산성 루틴',
        description: '자기관리 + 클라이언트 작업 균형',
        category: 'freelancer',
        schedules: [
            { text: '모닝 루틴 (운동 + 식사)', startTime: '07:00', endTime: '08:30', color: '#10B981' },
            { text: '이메일 & 클라이언트 소통', startTime: '09:00', endTime: '09:30', color: '#F59E0B' },
            { text: '핵심 작업 블록 1', startTime: '09:30', endTime: '12:00', color: '#8B5CF6' },
            { text: '점심 + 산책', startTime: '12:00', endTime: '13:00', color: '#10B981' },
            { text: '핵심 작업 블록 2', startTime: '13:30', endTime: '16:00', color: '#8B5CF6' },
            { text: '관리 업무 (청구서, 계획)', startTime: '16:00', endTime: '17:00', color: '#3B82F6' },
        ],
        tags: ['프리랜서', '생산성', '자기관리'],
    },
    // Health
    {
        id: 'health-morning',
        nameKo: '건강한 아침 루틴',
        description: '운동 + 명상으로 시작하는 하루',
        category: 'health',
        schedules: [
            { text: '기상 + 물 한 잔', startTime: '06:00', endTime: '06:10', color: '#10B981' },
            { text: '명상', startTime: '06:10', endTime: '06:30', color: '#8B5CF6' },
            { text: '아침 운동', startTime: '06:30', endTime: '07:30', color: '#EF4444' },
            { text: '샤워 + 준비', startTime: '07:30', endTime: '08:00', color: '#3B82F6' },
            { text: '건강한 아침 식사', startTime: '08:00', endTime: '08:30', color: '#F59E0B' },
            { text: '저널링 (감사 일기)', startTime: '08:30', endTime: '08:45', color: '#EC4899' },
        ],
        tags: ['건강', '아침', '운동', '명상'],
    },
    {
        id: 'health-evening',
        nameKo: '숙면 저녁 루틴',
        description: '질 좋은 수면을 위한 저녁 루틴',
        category: 'health',
        schedules: [
            { text: '가벼운 저녁 식사', startTime: '19:00', endTime: '19:30', color: '#F59E0B' },
            { text: '산책 or 가벼운 스트레칭', startTime: '19:30', endTime: '20:00', color: '#10B981' },
            { text: '독서 시간', startTime: '20:00', endTime: '21:00', color: '#EC4899' },
            { text: '하루 돌아보기 + 내일 계획', startTime: '21:00', endTime: '21:20', color: '#3B82F6' },
            { text: '스크린 끄기 + 명상', startTime: '21:20', endTime: '21:45', color: '#8B5CF6' },
            { text: '취침', startTime: '22:00', endTime: '22:00', color: '#6B7280' },
        ],
        tags: ['건강', '수면', '저녁'],
    },
    // General
    {
        id: 'general-balanced',
        nameKo: '균형 잡힌 하루',
        description: '일/학습/운동/취미 균형',
        category: 'general',
        schedules: [
            { text: '기상 + 스트레칭', startTime: '07:00', endTime: '07:20', color: '#10B981' },
            { text: '아침 식사', startTime: '07:20', endTime: '07:50', color: '#F59E0B' },
            { text: '핵심 업무/공부', startTime: '09:00', endTime: '12:00', color: '#8B5CF6' },
            { text: '점심 식사', startTime: '12:00', endTime: '13:00', color: '#F59E0B' },
            { text: '오후 업무/공부', startTime: '14:00', endTime: '17:00', color: '#3B82F6' },
            { text: '운동', startTime: '17:30', endTime: '18:30', color: '#EF4444' },
            { text: '저녁 + 자유시간', startTime: '19:00', endTime: '21:00', color: '#F59E0B' },
            { text: '자기계발 (독서/강의)', startTime: '21:00', endTime: '22:00', color: '#EC4899' },
        ],
        tags: ['균형', '일반'],
    },
    {
        id: 'general-minimal',
        nameKo: '미니멀 루틴',
        description: '핵심만 잡은 간단한 루틴',
        category: 'general',
        schedules: [
            { text: '기상 + 준비', startTime: '07:30', endTime: '08:00', color: '#10B981' },
            { text: '핵심 업무', startTime: '09:00', endTime: '12:00', color: '#8B5CF6' },
            { text: '운동', startTime: '18:00', endTime: '19:00', color: '#EF4444' },
            { text: '자기계발', startTime: '21:00', endTime: '22:00', color: '#EC4899' },
        ],
        tags: ['미니멀', '간단'],
    },
    {
        id: 'general-weekend',
        nameKo: '생산적인 주말',
        description: '여유 + 자기계발 주말 루틴',
        category: 'general',
        schedules: [
            { text: '늦은 기상 + 브런치', startTime: '09:00', endTime: '10:00', color: '#F59E0B' },
            { text: '취미/사이드 프로젝트', startTime: '10:30', endTime: '12:30', color: '#EC4899' },
            { text: '점심 + 산책', startTime: '12:30', endTime: '14:00', color: '#10B981' },
            { text: '독서/강의', startTime: '14:30', endTime: '16:00', color: '#8B5CF6' },
            { text: '운동', startTime: '16:30', endTime: '17:30', color: '#EF4444' },
            { text: '자유 시간', startTime: '18:00', endTime: '22:00', color: '#F59E0B' },
        ],
        tags: ['주말', '여유', '자기계발'],
    },
    {
        id: 'health-diet',
        nameKo: '다이어트 루틴',
        description: '식사 관리 + 운동 중심',
        category: 'health',
        schedules: [
            { text: '기상 + 공복 물', startTime: '06:30', endTime: '06:40', color: '#10B981' },
            { text: '아침 유산소 (30분)', startTime: '06:40', endTime: '07:10', color: '#EF4444' },
            { text: '건강한 아침 (단백질 위주)', startTime: '07:30', endTime: '08:00', color: '#F59E0B' },
            { text: '간식 (견과류/과일)', startTime: '10:30', endTime: '10:40', color: '#F59E0B' },
            { text: '점심 (현미밥 + 샐러드)', startTime: '12:00', endTime: '12:30', color: '#F59E0B' },
            { text: '오후 근력 운동', startTime: '17:00', endTime: '18:00', color: '#EF4444' },
            { text: '가벼운 저녁', startTime: '18:30', endTime: '19:00', color: '#F59E0B' },
        ],
        tags: ['다이어트', '운동', '식단'],
    },
    {
        id: 'dev-remote',
        nameKo: '재택근무 루틴',
        description: '재택에서도 생산적인 하루',
        category: 'developer',
        schedules: [
            { text: '기상 + 간단한 운동', startTime: '08:00', endTime: '08:30', color: '#10B981' },
            { text: '아침 식사 + 커피', startTime: '08:30', endTime: '09:00', color: '#F59E0B' },
            { text: '스탠드업 미팅', startTime: '09:30', endTime: '09:45', color: '#3B82F6' },
            { text: '딥워크 블록 1', startTime: '10:00', endTime: '12:00', color: '#8B5CF6' },
            { text: '점심 + 바깥 산책', startTime: '12:00', endTime: '13:00', color: '#10B981' },
            { text: '딥워크 블록 2', startTime: '13:30', endTime: '15:30', color: '#8B5CF6' },
            { text: '코드 리뷰 & 협업', startTime: '15:30', endTime: '17:00', color: '#3B82F6' },
            { text: '업무 종료 + 정리', startTime: '17:00', endTime: '17:15', color: '#6B7280' },
        ],
        tags: ['재택', '개발', '원격'],
    },
];

/**
 * 카테고리별 템플릿 필터
 */
export function getTemplatesByCategory(category?: string): RoutineTemplate[] {
    if (!category || category === 'all') return ROUTINE_TEMPLATES;
    return ROUTINE_TEMPLATES.filter(t => t.category === category);
}

/**
 * ID로 템플릿 조회
 */
export function getTemplateById(id: string): RoutineTemplate | undefined {
    return ROUTINE_TEMPLATES.find(t => t.id === id);
}
