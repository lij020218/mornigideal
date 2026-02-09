/**
 * 일정 아이콘 매핑 + 메시지 생성
 * page.tsx에서 추출 — UI 컴포넌트 의존 없음
 */

import {
    Sun, Moon, Coffee, Utensils, Dumbbell, BookOpen, Briefcase,
    Target, Heart, Gamepad2, Film, Tv, Music, Activity, TreePine,
    Rocket, Brain, BarChart3, Megaphone, FileText, Hospital,
    Lightbulb, Pen, Code, CheckCircle2,
    type LucideIcon,
} from "lucide-react";

/** 활동 라벨 → 아이콘 정확 매칭 (대시보드 DailyRhythmTimeline 일치) */
const activityIcons: Record<string, LucideIcon> = {
    '기상': Sun,
    '업무 시작': Briefcase,
    '업무/수업 시작': Briefcase,
    '업무 종료': Briefcase,
    '업무/수업 종료': Briefcase,
    '취침': Moon,
    '아침 식사': Coffee,
    '점심 식사': Coffee,
    '저녁 식사': Coffee,
    '운동': Dumbbell,
    '독서': BookOpen,
    '자기계발': Target,
    '병원': Heart,
    '휴식/여가': Gamepad2,
};

/** 일정 텍스트에 맞는 아이콘 반환 */
export function getScheduleIcon(text: string): LucideIcon {
    // 1. 정확 매칭
    if (activityIcons[text]) {
        return activityIcons[text];
    }

    // 2. 키워드 매칭
    const lowerText = text.toLowerCase();

    if (lowerText.includes('식사') || lowerText.includes('아침') || lowerText.includes('점심') || lowerText.includes('저녁')) return Utensils;
    if (lowerText.includes('기상') || lowerText.includes('일어나')) return Sun;
    if (lowerText.includes('취침') || lowerText.includes('잠')) return Moon;
    if (lowerText.includes('업무') || lowerText.includes('수업') || lowerText.includes('출근')) {
        return lowerText.includes('종료') ? CheckCircle2 : Briefcase;
    }
    if (lowerText.includes('운동') || lowerText.includes('헬스')) return Dumbbell;
    if (lowerText.includes('요가')) return Activity;
    if (lowerText.includes('병원') || lowerText.includes('진료')) return Hospital;
    if (lowerText.includes('거북목') || lowerText.includes('스트레칭')) return Activity;
    if (lowerText.includes('산책')) return TreePine;
    if (lowerText.includes('독서') || lowerText.includes('책') || lowerText.includes('읽기')) return BookOpen;
    if (lowerText.includes('공부') || lowerText.includes('학습')) return Pen;
    if (lowerText.includes('자기계발')) return Lightbulb;
    if (lowerText.includes('휴식')) return Coffee;
    if (lowerText.includes('게임')) return Gamepad2;
    if (lowerText.includes('영화')) return Film;
    if (lowerText.includes('드라마') || lowerText.includes('tv')) return Tv;
    if (lowerText.includes('음악')) return Music;
    if (lowerText.includes('여가') || lowerText.includes('취미')) return Heart;
    if (lowerText.includes('스타트업') || lowerText.includes('린 스타트업') || lowerText.includes('mvp')) return Rocket;
    if (lowerText.includes('프로젝트') || lowerText.includes('실습')) return Code;
    if (lowerText.includes('ai') || lowerText.includes('알고리즘')) return Brain;
    if (lowerText.includes('분석')) return BarChart3;
    if (lowerText.includes('캠페인') || lowerText.includes('마케팅')) return Megaphone;
    if (lowerText.includes('기획') || lowerText.includes('콘텐츠')) return FileText;

    return Target;
}

/** 일정 텍스트 + 상태에 맞는 개인화 메시지 */
export function getScheduleMessage(text: string, status: 'in-progress' | 'upcoming'): string {
    const lowerText = text.toLowerCase();

    if (status === 'in-progress') {
        if (lowerText.includes('종료') || lowerText.includes('마침') || lowerText.includes('끝')) {
            if (lowerText.includes('업무') || lowerText.includes('작업')) return '업무 마무리 시간이에요! 정리해볼까요? ✅';
            if (lowerText.includes('회의') || lowerText.includes('미팅')) return '회의 마무리 시간! 결론 정리하세요 📝';
            return '마무리 시간이에요! 정리해볼까요? ✅';
        }
        if (lowerText.includes('아침')) return '좋은 아침이에요! 맛있게 드세요 😊';
        if (lowerText.includes('점심')) return '점심 시간이에요! 맛있게 드세요 🍽️';
        if (lowerText.includes('저녁') || lowerText.includes('식사')) return '저녁 시간이에요! 맛있게 드세요 ✨';
        if (lowerText.includes('취침') || lowerText.includes('수면')) return '편안한 밤 되세요! 푹 쉬시길 🌙';
        if (lowerText.includes('운동') || lowerText.includes('헬스')) return '운동 시간이에요! 파이팅 💪';
        if (lowerText.includes('요가')) return '요가로 몸과 마음을 편안하게 🧘';
        if (lowerText.includes('조깅') || lowerText.includes('러닝')) return '달리기 시간이에요! 힘내세요 🏃';
        if (lowerText.includes('공부') || lowerText.includes('학습')) return '공부 시간이에요! 집중해볼까요? 📚';
        if (lowerText.includes('독서') || lowerText.includes('책')) return '독서 시간이에요! 좋은 책과 함께 📖';
        if (lowerText.includes('업무') || lowerText.includes('작업')) return '업무 시간이에요! 오늘도 화이팅 💼';
        if (lowerText.includes('회의') || lowerText.includes('미팅')) return '회의 시간이에요! 준비되셨나요? 🤝';
        return '지금 하고 있는 일에 집중하세요! 🎯';
    } else {
        if (lowerText.includes('종료') || lowerText.includes('마침') || lowerText.includes('끝')) {
            if (lowerText.includes('업무') || lowerText.includes('작업')) return '곧 업무 마무리 시간! 정리 준비하세요';
            if (lowerText.includes('회의') || lowerText.includes('미팅')) return '곧 회의 마무리! 요약 준비하세요';
            return '곧 마무리 시간! 정리 준비하세요';
        }
        if (lowerText.includes('아침')) return '곧 아침 식사 시간이에요!';
        if (lowerText.includes('점심')) return '곧 점심 시간이에요!';
        if (lowerText.includes('저녁') || lowerText.includes('식사')) return '곧 저녁 시간이에요!';
        if (lowerText.includes('취침') || lowerText.includes('수면')) return '곧 취침 시간이에요. 준비하세요';
        if (lowerText.includes('운동') || lowerText.includes('헬스') || lowerText.includes('요가')) return '곧 운동 시간! 준비운동 하세요';
        if (lowerText.includes('공부') || lowerText.includes('학습')) return '곧 학습 시간! 교재를 준비하세요';
        if (lowerText.includes('독서')) return '곧 독서 시간! 책을 펼쳐보세요';
        if (lowerText.includes('업무') || lowerText.includes('작업')) return '곧 업무 시작! 파일을 확인하세요';
        if (lowerText.includes('회의') || lowerText.includes('미팅')) return '곧 회의 시작! 자료를 준비하세요';
        return '다음 일정이 곧 시작됩니다!';
    }
}
