import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, getUserById, updateUserProfile, updateUserProfileById } from "@/lib/users";
import { withAuth } from "@/lib/api-handler";
import { getUserIdFromRequest } from "@/lib/auth-utils";
import { longTermGoalSchema, validateBody } from '@/lib/schemas';
import { logger } from '@/lib/logger';
import { dualWriteDelete } from '@/lib/schedule-dual-write';

// 장기 목표 타입 정의
export interface LongTermGoal {
    id: string;
    type: "weekly" | "monthly" | "yearly";
    title: string;
    description?: string;
    category?: string; // 커리어, 건강, 학습, 재정 등
    targetDate?: string;
    progress: number; // 0-100
    milestones?: { id: string; title: string; completed: boolean }[];
    completed: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LongTermGoals {
    weekly: LongTermGoal[];
    monthly: LongTermGoal[];
    yearly: LongTermGoal[];
}

export interface GoalBadge {
    id: string;
    title: string;
    category?: string;
    weekLabel: string; // "3월 2주차"
    progress: number;
    claimedAt: string;
}

/** 현재 KST 기준 이번 주 월요일 00:00 (YYYY-MM-DD) */
function getCurrentWeekMonday(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const day = kst.getUTCDay(); // 0=일, 1=월 ...
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(kst);
    monday.setUTCDate(kst.getUTCDate() + mondayOffset);
    return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
}

/** 목표의 createdAt이 이번 주(월~일) 범위인지 확인 */
function isCurrentWeekGoal(goal: LongTermGoal): boolean {
    if (!goal.createdAt) return true; // createdAt 없으면 현재 주로 간주
    const mondayStr = getCurrentWeekMonday();
    const monday = new Date(mondayStr + 'T00:00:00+09:00');
    const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    const created = new Date(goal.createdAt);
    return created >= monday && created <= sunday;
}

// GET: 장기 목표 조회
export const GET = withAuth(async (request: NextRequest, email: string) => {
    const userId = await getUserIdFromRequest(request);

    let user;
    if (userId) {
        user = await getUserById(userId);
    } else {
        user = await getUserByEmail(email);
    }

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rawGoals = user.profile?.longTermGoals;
    const longTermGoals: LongTermGoals = {
        weekly: rawGoals?.weekly as LongTermGoal[] || [],
        monthly: rawGoals?.monthly as LongTermGoal[] || [],
        yearly: rawGoals?.yearly as LongTermGoal[] || [],
    };

    // 주간 목표: 이번 주가 아닌 목표 분류
    // - 100% 달성 → completable (뱃지 획득 가능)
    // - 미달성 → expired (지난 목표)
    longTermGoals.weekly = longTermGoals.weekly.map(goal => {
        if (goal.completed || isCurrentWeekGoal(goal)) return goal;
        if (goal.progress >= 100) {
            return { ...goal, completable: true };
        }
        return { ...goal, expired: true };
    });

    // 뱃지 목록도 함께 반환
    const goalBadges = (user.profile?.goalBadges || []) as GoalBadge[];

    return NextResponse.json({ goals: longTermGoals, badges: goalBadges });
});

// POST: 장기 목표 추가/수정/삭제
export const POST = withAuth(async (request: NextRequest, email: string) => {
    const userId = await getUserIdFromRequest(request);

    const body = await request.json();
    const v = validateBody(longTermGoalSchema, body);
    if (!v.success) return v.response;
    const { goal, action } = v.data;

    let user;
    if (userId) {
        user = await getUserById(userId);
    } else {
        user = await getUserByEmail(email);
    }

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rawGoals = user.profile?.longTermGoals;
    const currentGoals: LongTermGoals = {
        weekly: rawGoals?.weekly as LongTermGoal[] || [],
        monthly: rawGoals?.monthly as LongTermGoal[] || [],
        yearly: rawGoals?.yearly as LongTermGoal[] || [],
    };

    const now = new Date().toISOString();
    const goalType = goal.type as keyof LongTermGoals;

    // 프로필 업데이트 헬퍼 함수
    const updateProfile = async (updates: any) => {
        if (userId) {
            await updateUserProfileById(userId, updates);
        } else {
            await updateUserProfile(email, updates);
        }
    };

    if (action === "add") {
        // 새 목표 추가
        const newGoal: LongTermGoal = {
            id: `goal-${Date.now()}`,
            type: goalType,
            title: goal.title || "",
            description: goal.description || "",
            category: goal.category || "general",
            targetDate: goal.targetDate,
            progress: 0,
            milestones: goal.milestones || [],
            completed: false,
            createdAt: now,
            updatedAt: now,
        };

        currentGoals[goalType].push(newGoal);
    } else if (action === "update") {
        // 기존 목표 수정
        const goalList = currentGoals[goalType];
        const index = goalList.findIndex((g) => g.id === goal.id);
        if (index !== -1) {
            goalList[index] = {
                ...goalList[index],
                title: goal.title ?? goalList[index].title,
                description: goal.description ?? goalList[index].description,
                category: goal.category ?? goalList[index].category,
                targetDate: goal.targetDate ?? goalList[index].targetDate,
                progress: goal.progress ?? goalList[index].progress,
                milestones: goal.milestones ?? goalList[index].milestones,
                completed: goal.completed ?? goalList[index].completed,
                updatedAt: now,
            };
        }
    } else if (action === "delete") {
        // 목표 삭제
        currentGoals[goalType] = currentGoals[goalType].filter(
            (g) => g.id !== goal.id
        );

        // 연관 일정(customGoals에서 linkedGoalId가 이 목표인 것)도 함께 삭제
        const customGoals: any[] = user.profile?.customGoals || [];
        const removedSchedules = customGoals.filter(
            (s: any) => s.linkedGoalId === goal.id
        );
        const filteredGoals = customGoals.filter(
            (s: any) => s.linkedGoalId !== goal.id
        );

        // schedules 테이블에서도 연관 일정 삭제
        for (const removed of removedSchedules) {
            await dualWriteDelete(email, removed.id).catch(e =>
                logger.error(`[long-term-goals] schedules 테이블 삭제 실패 (${removed.id}):`, e)
            );
        }

        if (filteredGoals.length !== customGoals.length) {
            const removedCount = removedSchedules.length;
            logger.info(`[long-term-goals] 목표 ${goal.id} 삭제 시 연관 일정 ${removedCount}개 함께 삭제`);
            await updateProfile({
                longTermGoals: currentGoals,
                customGoals: filteredGoals,
            });
            return NextResponse.json({ success: true, goals: currentGoals, removedSchedules: removedCount });
        }
    } else if (action === "complete") {
        // 목표 완료 처리 — 연관 일정이 모두 완료되었는지 체크
        const customGoals = user.profile?.customGoals || [];
        const linkedSchedules = customGoals.filter(
            (s: any) => s.linkedGoalId === goal.id
        );

        if (linkedSchedules.length > 0) {
            const incompleteSchedules = linkedSchedules.filter(
                (s: any) => !s.completed
            );
            if (incompleteSchedules.length > 0) {
                return NextResponse.json({
                    error: `연관된 일정 ${incompleteSchedules.length}개를 먼저 완료해야 목표를 달성할 수 있어요.`,
                }, { status: 400 });
            }
        }

        const goalList = currentGoals[goalType];
        const index = goalList.findIndex((g) => g.id === goal.id);
        if (index !== -1) {
            goalList[index].completed = true;
            goalList[index].progress = 100;
            goalList[index].updatedAt = now;
        }
    } else if (action === "updateProgress") {
        // 진행률 업데이트
        const goalList = currentGoals[goalType];
        const index = goalList.findIndex((g) => g.id === goal.id);
        if (index !== -1) {
            goalList[index].progress = Math.min(100, Math.max(0, goal.progress ?? 0));
            if (goalList[index].progress >= 100) {
                goalList[index].completed = true;
            }
            goalList[index].updatedAt = now;
        }
    } else if (action === "resetWeekly") {
        // 주간 목표 리셋 (일요일→월요일 전환 시)
        // 기존 주간 목표를 아카이브에 저장하고 새로 시작
        const archivedWeeklyGoals = (user.profile?.archivedWeeklyGoals || []) as Array<{ weekStart: string; weekEnd: string; goals: LongTermGoal[]; archivedAt: string }>;

        // 이번 주 목표가 있으면 아카이브에 추가
        if (currentGoals.weekly.length > 0) {
            const weekEndDate = new Date();
            weekEndDate.setDate(weekEndDate.getDate() - 1); // 어제 (일요일)
            const weekStartDate = new Date(weekEndDate);
            weekStartDate.setDate(weekStartDate.getDate() - 6); // 지난 월요일

            archivedWeeklyGoals.push({
                weekStart: weekStartDate.toISOString().split('T')[0],
                weekEnd: weekEndDate.toISOString().split('T')[0],
                goals: currentGoals.weekly,
                archivedAt: now,
            });

            // 최근 12주만 보관 (3개월)
            if (archivedWeeklyGoals.length > 12) {
                archivedWeeklyGoals.shift();
            }
        }

        // 주간 목표 초기화
        currentGoals.weekly = [];

        // 아카이브 저장
        await updateProfile({
            longTermGoals: currentGoals,
            archivedWeeklyGoals: archivedWeeklyGoals,
        });

        return NextResponse.json({
            success: true,
            goals: currentGoals,
            archived: archivedWeeklyGoals.length > 0 ? archivedWeeklyGoals[archivedWeeklyGoals.length - 1] : null,
        });
    } else if (action === "claim") {
        // 지난 주 달성 목표 뱃지 획득 → 목록에서 제거
        const targetGoal = currentGoals[goalType].find(g => g.id === goal.id);
        if (!targetGoal) {
            return NextResponse.json({ error: "목표를 찾을 수 없습니다." }, { status: 404 });
        }

        // 주차 라벨 생성 (목표 생성일 기준)
        const createdDate = new Date(targetGoal.createdAt);
        const kstCreated = new Date(createdDate.getTime() + 9 * 60 * 60 * 1000);
        const month = kstCreated.getUTCMonth() + 1;
        const weekOfMonth = Math.ceil(kstCreated.getUTCDate() / 7);
        const weekLabel = `${month}월 ${weekOfMonth}주차`;

        const badge: GoalBadge = {
            id: `badge-${targetGoal.id}`,
            title: targetGoal.title,
            category: targetGoal.category,
            weekLabel,
            progress: targetGoal.progress,
            claimedAt: now,
        };

        // 뱃지 배열에 추가
        const goalBadges = (user.profile?.goalBadges || []) as GoalBadge[];
        goalBadges.push(badge);

        // 목표 목록에서 제거 + 연관 일정도 정리
        currentGoals[goalType] = currentGoals[goalType].filter(g => g.id !== goal.id);

        const customGoals: any[] = user.profile?.customGoals || [];
        const filteredSchedules = customGoals.filter((s: any) => s.linkedGoalId !== goal.id);

        // schedules 테이블에서도 연관 일정 삭제
        const removedSchedules = customGoals.filter((s: any) => s.linkedGoalId === goal.id);
        for (const removed of removedSchedules) {
            await dualWriteDelete(email, removed.id).catch(e =>
                logger.error(`[long-term-goals] claim 시 schedules 삭제 실패 (${removed.id}):`, e)
            );
        }

        await updateProfile({
            longTermGoals: currentGoals,
            goalBadges,
            customGoals: filteredSchedules,
        });

        return NextResponse.json({ success: true, goals: currentGoals, badge, badges: goalBadges });
    }

    // 프로필 업데이트
    await updateProfile({ longTermGoals: currentGoals });

    return NextResponse.json({ success: true, goals: currentGoals });
});
