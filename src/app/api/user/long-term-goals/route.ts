import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByEmail, updateUserProfile } from "@/lib/users";

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

// GET: 장기 목표 조회
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getUserByEmail(session.user.email);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const longTermGoals: LongTermGoals = user.profile?.longTermGoals || {
            weekly: [],
            monthly: [],
            yearly: [],
        };

        return NextResponse.json({ goals: longTermGoals });
    } catch (error) {
        console.error("[LongTermGoals API] GET Error:", error);
        return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
    }
}

// POST: 장기 목표 추가/수정/삭제
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { goal, action } = await request.json();

        if (!goal || !goal.type) {
            return NextResponse.json({ error: "Goal data required" }, { status: 400 });
        }

        const user = await getUserByEmail(session.user.email);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const currentGoals: LongTermGoals = user.profile?.longTermGoals || {
            weekly: [],
            monthly: [],
            yearly: [],
        };

        const now = new Date().toISOString();
        const goalType = goal.type as keyof LongTermGoals;

        if (!["weekly", "monthly", "yearly"].includes(goalType)) {
            return NextResponse.json({ error: "Invalid goal type" }, { status: 400 });
        }

        if (action === "add") {
            // 새 목표 추가
            const newGoal: LongTermGoal = {
                id: `goal-${Date.now()}`,
                type: goalType,
                title: goal.title,
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
        } else if (action === "complete") {
            // 목표 완료 처리
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
                goalList[index].progress = Math.min(100, Math.max(0, goal.progress));
                if (goalList[index].progress >= 100) {
                    goalList[index].completed = true;
                }
                goalList[index].updatedAt = now;
            }
        } else if (action === "resetWeekly") {
            // 주간 목표 리셋 (일요일→월요일 전환 시)
            // 기존 주간 목표를 아카이브에 저장하고 새로 시작
            const archivedWeeklyGoals = user.profile?.archivedWeeklyGoals || [];

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
            await updateUserProfile(session.user.email, {
                longTermGoals: currentGoals,
                archivedWeeklyGoals: archivedWeeklyGoals,
            });

            return NextResponse.json({
                success: true,
                goals: currentGoals,
                archived: archivedWeeklyGoals.length > 0 ? archivedWeeklyGoals[archivedWeeklyGoals.length - 1] : null,
            });
        }

        // 프로필 업데이트
        await updateUserProfile(session.user.email, { longTermGoals: currentGoals });

        return NextResponse.json({ success: true, goals: currentGoals });
    } catch (error) {
        console.error("[LongTermGoals API] POST Error:", error);
        return NextResponse.json({ error: "Failed to update goals" }, { status: 500 });
    }
}
