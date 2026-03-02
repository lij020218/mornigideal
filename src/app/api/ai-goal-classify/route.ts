/**
 * 목표 카테고리 분류 API
 *
 * AI 호출 제거 — 키워드 매칭 + 카테고리별 기본 스케줄 테이블로 대체
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";

// Category definitions
const CATEGORIES = {
    work: { emoji: "💼", label: "업무", color: "#8B5CF6" },
    study: { emoji: "📚", label: "학습", color: "#3B82F6" },
    exercise: { emoji: "🏃", label: "운동", color: "#10B981" },
    wellness: { emoji: "🧘", label: "웰빙", color: "#F59E0B" },
    other: { emoji: "✨", label: "기타", color: "#6B7280" },
};

type CategoryKey = keyof typeof CATEGORIES;

// 카테고리별 키워드 (프롬프트에 있던 것 + 추가)
const CATEGORY_KEYWORDS: Record<CategoryKey, RegExp> = {
    work: /회의|프로젝트|보고서|출근|퇴근|미팅|업무|직장|발표|면접|이력서|포트폴리오|회사|야근|출장|거래처|클라이언트|프레젠테이션|마감|데드라인|인터뷰/,
    study: /공부|영어|코딩|독서|자격증|강의|배우기|학습|수업|과제|시험|토익|토플|자바|파이썬|프로그래밍|논문|리서치|외국어|중국어|일본어|reading|study|book/i,
    exercise: /헬스|러닝|요가|산책|수영|운동|스포츠|필라테스|조깅|등산|축구|농구|테니스|자전거|스트레칭|웨이트|크로스핏|마라톤|배드민턴|클라이밍/,
    wellness: /명상|수면|휴식|취미|여가|힐링|자기관리|취침|기상|낮잠|스킨케어|목욕|반신욕|아로마|일기|감사|마음챙김|루틴|멘탈|정리|청소|다이어리/,
    other: /$/,  // 매치 안 됨 — fallback
};

// 카테고리별 기본 스케줄 추천
const DEFAULT_SCHEDULES: Record<CategoryKey, { frequency: string; duration: number; bestTime: string }> = {
    work: { frequency: 'daily', duration: 60, bestTime: '오전' },
    study: { frequency: 'daily', duration: 45, bestTime: '오전' },
    exercise: { frequency: 'daily', duration: 30, bestTime: '아침' },
    wellness: { frequency: 'daily', duration: 20, bestTime: '저녁' },
    other: { frequency: 'once', duration: 30, bestTime: '오후' },
};

// 특정 키워드로 더 세밀한 스케줄 조정
const SCHEDULE_OVERRIDES: Array<{ pattern: RegExp; schedule: { frequency: string; duration: number; bestTime: string } }> = [
    { pattern: /시험|토익|토플|자격증/, schedule: { frequency: 'daily', duration: 60, bestTime: '오전' } },
    { pattern: /독서|reading|book/i, schedule: { frequency: 'daily', duration: 30, bestTime: '저녁' } },
    { pattern: /산책/, schedule: { frequency: 'daily', duration: 20, bestTime: '아침' } },
    { pattern: /명상|마음챙김/, schedule: { frequency: 'daily', duration: 15, bestTime: '아침' } },
    { pattern: /회의|미팅/, schedule: { frequency: 'once', duration: 60, bestTime: '오전' } },
    { pattern: /취침|수면/, schedule: { frequency: 'daily', duration: 0, bestTime: '밤' } },
    { pattern: /기상/, schedule: { frequency: 'daily', duration: 0, bestTime: '아침' } },
    { pattern: /헬스|웨이트|크로스핏/, schedule: { frequency: 'daily', duration: 60, bestTime: '오후' } },
    { pattern: /요가|필라테스/, schedule: { frequency: 'daily', duration: 50, bestTime: '아침' } },
    { pattern: /러닝|조깅|마라톤/, schedule: { frequency: 'daily', duration: 40, bestTime: '아침' } },
];

function classifyGoal(goalText: string): CategoryKey {
    const text = goalText.toLowerCase();
    for (const [category, pattern] of Object.entries(CATEGORY_KEYWORDS)) {
        if (category === 'other') continue;
        if (pattern.test(text)) return category as CategoryKey;
    }
    return 'other';
}

function getSuggestedSchedule(goalText: string, category: CategoryKey) {
    const text = goalText.toLowerCase();
    for (const override of SCHEDULE_OVERRIDES) {
        if (override.pattern.test(text)) return override.schedule;
    }
    return DEFAULT_SCHEDULES[category];
}

export const POST = withAuth(async (request: NextRequest, _email: string) => {
    const { goalText } = await request.json();

    if (!goalText || goalText.trim().length === 0) {
        return NextResponse.json({ error: "Goal text is required" }, { status: 400 });
    }

    const category = classifyGoal(goalText);
    const categoryInfo = CATEGORIES[category];
    const suggestedSchedule = getSuggestedSchedule(goalText, category);

    return NextResponse.json({
        success: true,
        original: goalText,
        category,
        categoryInfo,
        refinedGoal: goalText,
        suggestedSchedule,
    });
});
