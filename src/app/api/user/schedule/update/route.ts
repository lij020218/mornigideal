import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getUserEmailWithAuth } from "@/lib/auth-utils";

interface LongTermGoal {
    id: string;
    type: "weekly" | "monthly" | "yearly";
    title: string;
    progress: number;
    completed: boolean;
    [key: string]: any;
}

interface LongTermGoals {
    weekly: LongTermGoal[];
    monthly: LongTermGoal[];
    yearly: LongTermGoal[];
}

// Calculate goal progress based on linked schedules completion
function calculateGoalProgress(
    goalId: string,
    goalType: 'weekly' | 'monthly' | 'yearly',
    customGoals: any[],
    today: string
): number {
    // Find all schedules linked to this goal
    const linkedSchedules = customGoals.filter(
        (g: any) => g.linkedGoalId === goalId && g.linkedGoalType === goalType
    );

    if (linkedSchedules.length === 0) return 0;

    // For weekly goals, count completed schedules this week
    // For monthly goals, count this month
    // For yearly goals, count this year
    const now = new Date(today);
    let startDate: Date;
    let endDate: Date = now;

    if (goalType === 'weekly') {
        // Start of week (Sunday)
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
    } else if (goalType === 'monthly') {
        // Start of month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
        // Start of year
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Count completed schedules within the period
    let completedCount = 0;
    let totalCount = 0;

    linkedSchedules.forEach((schedule: any) => {
        // For specific date schedules
        if (schedule.specificDate) {
            if (schedule.specificDate >= startStr && schedule.specificDate <= endStr) {
                totalCount++;
                if (schedule.completed) completedCount++;
            }
        } else if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
            // For recurring schedules, count occurrences in the period
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const dayOfWeek = currentDate.getDay();
                if (schedule.daysOfWeek.includes(dayOfWeek)) {
                    // Check if within schedule's date range
                    const dateStr = currentDate.toISOString().split('T')[0];
                    if ((!schedule.startDate || dateStr >= schedule.startDate) &&
                        (!schedule.endDate || dateStr <= schedule.endDate)) {
                        totalCount++;
                        // Only count as completed if this is today and it's marked completed
                        if (dateStr === today && schedule.completed) {
                            completedCount++;
                        }
                    }
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
    });

    // Calculate progress percentage
    if (totalCount === 0) return 0;
    return Math.round((completedCount / totalCount) * 100);
}

export async function POST(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { scheduleId, completed, skipped } = await request.json();

        if (!scheduleId) {
            return NextResponse.json({ error: "Schedule ID is required" }, { status: 400 });
        }

        // Get user profile
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', userEmail)
            .single();

        if (fetchError || !user?.profile?.customGoals) {
            return NextResponse.json({ error: "No schedules found" }, { status: 404 });
        }

        // Find the schedule being updated to check for linked goal
        const targetSchedule = user.profile.customGoals.find((g: any) => g.id === scheduleId);
        const linkedGoalId = targetSchedule?.linkedGoalId;
        const linkedGoalType = targetSchedule?.linkedGoalType;

        // Update the specific schedule
        const updatedGoals = user.profile.customGoals.map((goal: any) => {
            if (goal.id === scheduleId) {
                return {
                    ...goal,
                    completed: completed !== undefined ? completed : goal.completed,
                    skipped: skipped !== undefined ? skipped : goal.skipped,
                };
            }
            return goal;
        });

        // Get today's date for progress calculation
        const today = new Date().toISOString().split('T')[0];

        // Update linked goal progress if applicable
        let updatedLongTermGoals = user.profile.longTermGoals;
        if (linkedGoalId && linkedGoalType && updatedLongTermGoals) {
            const newProgress = calculateGoalProgress(
                linkedGoalId,
                linkedGoalType,
                updatedGoals, // Use updated goals to get correct completion state
                today
            );

            // Update the goal's progress
            const goalList = updatedLongTermGoals[linkedGoalType] || [];
            updatedLongTermGoals = {
                ...updatedLongTermGoals,
                [linkedGoalType]: goalList.map((goal: LongTermGoal) => {
                    if (goal.id === linkedGoalId) {
                        return {
                            ...goal,
                            progress: newProgress,
                            completed: newProgress >= 100,
                            updatedAt: new Date().toISOString(),
                        };
                    }
                    return goal;
                }),
            };

            console.log(`[schedule/update] Updated goal ${linkedGoalId} progress to ${newProgress}%`);
        }

        // Update profile with new goals
        const updatedProfile = {
            ...user.profile,
            customGoals: updatedGoals,
            ...(updatedLongTermGoals && { longTermGoals: updatedLongTermGoals }),
        };

        // Save back to database
        const { error: updateError } = await supabase
            .from('users')
            .update({ profile: updatedProfile })
            .eq('email', userEmail);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({
            success: true,
            message: "Schedule updated successfully",
            goalProgressUpdated: linkedGoalId ? true : false,
        });

    } catch (error) {
        console.error("[schedule/update] Error:", error);
        return NextResponse.json({
            error: "Failed to update schedule"
        }, { status: 500 });
    }
}
