import { describe, it, expect } from 'vitest';
import { getScheduleIcon } from '@/components/features/dashboard/scheduleUtils';
import {
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
} from 'lucide-react';

describe('getScheduleIcon', () => {
    describe('meals (Utensils)', () => {
        it('returns Utensils for 식사', () => {
            expect(getScheduleIcon('식사')).toBe(Utensils);
        });

        it('returns Utensils for 아침', () => {
            expect(getScheduleIcon('아침 식사')).toBe(Utensils);
        });

        it('returns Utensils for 점심', () => {
            expect(getScheduleIcon('점심 먹기')).toBe(Utensils);
        });

        it('returns Utensils for 저녁', () => {
            expect(getScheduleIcon('저녁')).toBe(Utensils);
        });
    });

    describe('wake up (Sun)', () => {
        it('returns Sun for 기상', () => {
            expect(getScheduleIcon('기상')).toBe(Sun);
        });

        it('returns Sun for 일어나', () => {
            expect(getScheduleIcon('일어나기')).toBe(Sun);
        });
    });

    describe('sleep (Moon)', () => {
        it('returns Moon for 취침', () => {
            expect(getScheduleIcon('취침')).toBe(Moon);
        });

        it('returns Moon for 잠', () => {
            expect(getScheduleIcon('잠자기')).toBe(Moon);
        });
    });

    describe('work (Briefcase / CheckCircle2)', () => {
        it('returns Briefcase for 업무', () => {
            expect(getScheduleIcon('업무 시작')).toBe(Briefcase);
        });

        it('returns Briefcase for 수업', () => {
            expect(getScheduleIcon('수업')).toBe(Briefcase);
        });

        it('returns Briefcase for 출근', () => {
            expect(getScheduleIcon('출근')).toBe(Briefcase);
        });

        it('returns CheckCircle2 for 업무 종료', () => {
            expect(getScheduleIcon('업무 종료')).toBe(CheckCircle2);
        });

        it('returns CheckCircle2 for 수업 종료', () => {
            expect(getScheduleIcon('수업 종료')).toBe(CheckCircle2);
        });
    });

    describe('exercise (Dumbbell)', () => {
        it('returns Dumbbell for 운동', () => {
            expect(getScheduleIcon('운동')).toBe(Dumbbell);
        });

        it('returns Dumbbell for 헬스', () => {
            expect(getScheduleIcon('헬스장 가기')).toBe(Dumbbell);
        });
    });

    describe('yoga (Activity)', () => {
        it('returns Activity for 요가', () => {
            expect(getScheduleIcon('요가')).toBe(Activity);
        });
    });

    describe('hospital (Hospital)', () => {
        it('returns Hospital for 병원', () => {
            expect(getScheduleIcon('병원 방문')).toBe(Hospital);
        });

        it('returns Hospital for 진료', () => {
            expect(getScheduleIcon('진료 예약')).toBe(Hospital);
        });
    });

    describe('stretching (Activity)', () => {
        it('returns Activity for 거북목', () => {
            expect(getScheduleIcon('거북목 스트레칭')).toBe(Activity);
        });

        it('returns Activity for 스트레칭', () => {
            expect(getScheduleIcon('스트레칭')).toBe(Activity);
        });
    });

    describe('walk (TreePine)', () => {
        it('returns TreePine for 산책', () => {
            expect(getScheduleIcon('산책')).toBe(TreePine);
        });
    });

    describe('reading (BookOpen)', () => {
        it('returns BookOpen for 독서', () => {
            expect(getScheduleIcon('독서')).toBe(BookOpen);
        });

        it('returns BookOpen for 책', () => {
            expect(getScheduleIcon('책 읽기')).toBe(BookOpen);
        });

        it('returns BookOpen for 읽기', () => {
            expect(getScheduleIcon('읽기')).toBe(BookOpen);
        });
    });

    describe('study (Pen)', () => {
        it('returns Pen for 공부', () => {
            expect(getScheduleIcon('공부')).toBe(Pen);
        });

        it('returns Pen for 학습', () => {
            expect(getScheduleIcon('학습 시간')).toBe(Pen);
        });
    });

    describe('self-improvement (Lightbulb)', () => {
        it('returns Lightbulb for 자기계발', () => {
            expect(getScheduleIcon('자기계발')).toBe(Lightbulb);
        });
    });

    describe('rest (Coffee)', () => {
        it('returns Coffee for 휴식', () => {
            expect(getScheduleIcon('휴식')).toBe(Coffee);
        });
    });

    describe('entertainment', () => {
        it('returns Gamepad2 for 게임', () => {
            expect(getScheduleIcon('게임')).toBe(Gamepad2);
        });

        it('returns Film for 영화', () => {
            expect(getScheduleIcon('영화 보기')).toBe(Film);
        });

        it('returns Tv for 드라마', () => {
            expect(getScheduleIcon('드라마')).toBe(Tv);
        });

        it('returns Tv for tv', () => {
            expect(getScheduleIcon('tv 시청')).toBe(Tv);
        });

        it('returns Music for 음악', () => {
            expect(getScheduleIcon('음악 듣기')).toBe(Music);
        });
    });

    describe('leisure (Heart)', () => {
        it('returns Heart for 여가', () => {
            expect(getScheduleIcon('여가 시간')).toBe(Heart);
        });

        it('returns Heart for 취미', () => {
            expect(getScheduleIcon('취미 활동')).toBe(Heart);
        });
    });

    describe('startup / business (Rocket)', () => {
        it('returns Rocket for 스타트업', () => {
            expect(getScheduleIcon('스타트업')).toBe(Rocket);
        });

        it('returns Rocket for 린 스타트업', () => {
            expect(getScheduleIcon('린 스타트업')).toBe(Rocket);
        });

        it('returns Rocket for mvp', () => {
            expect(getScheduleIcon('mvp 개발')).toBe(Rocket);
        });
    });

    describe('project (Code)', () => {
        it('returns Code for 프로젝트', () => {
            expect(getScheduleIcon('프로젝트')).toBe(Code);
        });

        it('returns Code for 실습', () => {
            expect(getScheduleIcon('실습')).toBe(Code);
        });
    });

    describe('AI / algorithm (Brain)', () => {
        it('returns Brain for ai', () => {
            expect(getScheduleIcon('ai 모델 개선')).toBe(Brain);
        });

        it('returns Brain for 알고리즘', () => {
            expect(getScheduleIcon('알고리즘 정리')).toBe(Brain);
        });
    });

    describe('analysis (BarChart3)', () => {
        it('returns BarChart3 for 분석', () => {
            expect(getScheduleIcon('데이터 분석')).toBe(BarChart3);
        });
    });

    describe('campaign / marketing (Megaphone)', () => {
        it('returns Megaphone for 캠페인', () => {
            expect(getScheduleIcon('캠페인 기획')).toBe(Megaphone);
        });

        it('returns Megaphone for 마케팅', () => {
            expect(getScheduleIcon('마케팅 회의')).toBe(Megaphone);
        });
    });

    describe('planning / content (FileText)', () => {
        it('returns FileText for 기획', () => {
            expect(getScheduleIcon('기획 회의')).toBe(FileText);
        });

        it('returns FileText for 콘텐츠', () => {
            expect(getScheduleIcon('콘텐츠 작성')).toBe(FileText);
        });
    });

    describe('case insensitivity', () => {
        it('returns Tv for TV (uppercase)', () => {
            expect(getScheduleIcon('TV 시청')).toBe(Tv);
        });

        it('returns Rocket for MVP (uppercase)', () => {
            expect(getScheduleIcon('MVP 검증')).toBe(Rocket);
        });

        it('returns Brain for AI (uppercase)', () => {
            expect(getScheduleIcon('AI 모델 튜닝')).toBe(Brain);
        });
    });

    describe('default fallback (Target)', () => {
        it('returns Target for unrecognized text', () => {
            expect(getScheduleIcon('알 수 없는 일정')).toBe(Target);
        });

        it('returns Target for empty string', () => {
            expect(getScheduleIcon('')).toBe(Target);
        });

        it('returns Target for random English text', () => {
            expect(getScheduleIcon('random schedule')).toBe(Target);
        });
    });
});
