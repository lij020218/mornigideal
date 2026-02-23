import {
    type LucideIcon,
    Activity,
    BarChart3,
    BookOpen,
    Brain,
    Briefcase,
    CheckCircle2,
    Code,
    Coffee,
    Dumbbell,
    FileText,
    Film,
    Gamepad2,
    Heart,
    Hospital,
    Lightbulb,
    Megaphone,
    Moon,
    Music,
    Pen,
    Rocket,
    Sun,
    Target,
    TreePine,
    Tv,
    Utensils,
} from "lucide-react";

// Get icon for schedule based on text
export function getScheduleIcon(text: string): LucideIcon {
    const lowerText = text.toLowerCase();

    // 식사 (아침, 점심, 저녁 포함)
    if (lowerText.includes('식사') || lowerText.includes('아침') || lowerText.includes('점심') || lowerText.includes('저녁')) {
        return Utensils;
    }
    // 수면
    if (lowerText.includes('기상') || lowerText.includes('일어나')) {
        return Sun;
    }
    if (lowerText.includes('취침') || lowerText.includes('잠')) {
        return Moon;
    }
    // 업무 (시작/종료 포함)
    if (lowerText.includes('업무') || lowerText.includes('수업') || lowerText.includes('출근')) {
        if (lowerText.includes('종료')) {
            return CheckCircle2; // 종료는 체크 아이콘
        }
        return Briefcase;
    }
    // 운동
    if (lowerText.includes('운동') || lowerText.includes('헬스')) {
        return Dumbbell;
    }
    if (lowerText.includes('요가')) {
        return Activity;
    }
    // 건강
    if (lowerText.includes('병원') || lowerText.includes('진료')) {
        return Hospital;
    }
    if (lowerText.includes('거북목') || lowerText.includes('스트레칭')) {
        return Activity;
    }
    if (lowerText.includes('산책')) {
        return TreePine;
    }
    // 학습
    if (lowerText.includes('독서') || lowerText.includes('책') || lowerText.includes('읽기')) {
        return BookOpen;
    }
    if (lowerText.includes('공부') || lowerText.includes('학습')) {
        return Pen;
    }
    if (lowerText.includes('자기계발')) {
        return Lightbulb;
    }
    // 휴식
    if (lowerText.includes('휴식')) {
        return Coffee;
    }
    // 엔터테인먼트 (각 유형별 고유 아이콘)
    if (lowerText === '게임' || lowerText.includes('게임')) {
        return Gamepad2;
    }
    if (lowerText === '영화' || lowerText.includes('영화')) {
        return Film;
    }
    if (lowerText === '드라마' || lowerText.includes('드라마') || lowerText.includes('tv')) {
        return Tv;
    }
    if (lowerText.includes('음악')) {
        return Music;
    }
    // 여가 (일반)
    if (lowerText.includes('여가') || lowerText.includes('취미')) {
        return Heart;
    }
    // 프로젝트/스타트업/비즈니스
    if (lowerText.includes('스타트업') || lowerText.includes('린 스타트업') || lowerText.includes('mvp')) {
        return Rocket;
    }
    if (lowerText.includes('프로젝트') || lowerText.includes('실습')) {
        return Code;
    }
    if (lowerText.includes('ai') || lowerText.includes('알고리즘')) {
        return Brain;
    }
    if (lowerText.includes('분석')) {
        return BarChart3;
    }
    if (lowerText.includes('캠페인') || lowerText.includes('마케팅')) {
        return Megaphone;
    }
    if (lowerText.includes('기획') || lowerText.includes('콘텐츠')) {
        return FileText;
    }

    // 기본 아이콘 (매칭되지 않는 경우만)
    return Target;
}
