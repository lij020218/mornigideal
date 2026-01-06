import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const scheduleData = await request.json();
        const { text, startTime, endTime, color, specificDate, daysOfWeek, findAvailableSlot, estimatedDuration } = scheduleData;

        if (!text) {
            return NextResponse.json(
                { error: "text is required" },
                { status: 400 }
            );
        }

        // Get current user profile
        const { data: userData, error: fetchError } = await supabase
            .from("users")
            .select("profile")
            .eq("email", session.user.email)
            .single();

        if (fetchError || !userData) {
            console.error("[Schedule Add] Fetch error:", fetchError);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const profile = userData.profile || {};
        const customGoals = profile.customGoals || [];

        // Find available time slot if requested
        let calculatedStartTime = startTime;
        let calculatedEndTime = endTime;

        if (findAvailableSlot && specificDate) {
            const today = specificDate;
            const todaySchedules = customGoals.filter((g: any) => g.specificDate === today);

            // Parse estimated duration (e.g., "30분" -> 30, "1시간" -> 60)
            const durationMinutes = estimatedDuration?.includes("시간")
                ? parseInt(estimatedDuration) * 60
                : parseInt(estimatedDuration) || 30;

            // Find next available slot starting from current hour or 9 AM (whichever is later)
            const now = new Date();
            const currentHour = now.getHours();
            const startHour = Math.max(currentHour + 1, 9); // Start from next hour or 9 AM
            const endHour = 22; // Don't schedule past 10 PM

            let foundSlot = false;
            for (let hour = startHour; hour < endHour; hour++) {
                const slotStart = `${hour.toString().padStart(2, '0')}:00`;
                const slotEndHour = hour + Math.ceil(durationMinutes / 60);
                const slotEnd = `${slotEndHour.toString().padStart(2, '0')}:00`;

                // Check if this slot conflicts with existing schedules
                const hasConflict = todaySchedules.some((schedule: any) => {
                    const scheduleStart = parseInt(schedule.startTime.split(':')[0]);
                    const scheduleEnd = parseInt(schedule.endTime.split(':')[0]);
                    return (hour >= scheduleStart && hour < scheduleEnd) ||
                           (slotEndHour > scheduleStart && slotEndHour <= scheduleEnd);
                });

                if (!hasConflict && slotEndHour <= endHour) {
                    calculatedStartTime = slotStart;
                    calculatedEndTime = slotEnd;
                    foundSlot = true;
                    break;
                }
            }

            // If no slot found, default to end of day
            if (!foundSlot) {
                calculatedStartTime = "20:00";
                calculatedEndTime = "21:00";
            }
        }

        // Determine time of day
        const getTimeOfDay = (time: string): "morning" | "afternoon" | "evening" => {
            const hour = parseInt(time.split(":")[0]);
            if (hour < 12) return "morning";
            if (hour < 18) return "afternoon";
            return "evening";
        };

        // Activity color mapping (matching PRESET_ACTIVITIES in SchedulePopup)
        const ACTIVITY_COLORS: Record<string, string> = {
            '기상': 'yellow',
            '취침': 'blue',
            '업무/수업 시작': 'purple',
            '업무 시작': 'purple',
            '업무/수업 종료': 'green',
            '업무 종료': 'green',
            '아침 식사': 'orange',
            '아침': 'orange',
            '점심 식사': 'amber',
            '점심': 'amber',
            '저녁 식사': 'red',
            '저녁': 'red',
            '운동': 'pink',
            '헬스': 'pink',
            '요가': 'pink',
            '독서': 'cyan',
            '자기계발': 'indigo',
            '공부': 'indigo',
            '병원': 'red',
            '휴식': 'green',
            '여가': 'green',
            '휴식/여가': 'green',
        };

        // Get color based on activity name or use provided/default
        const getActivityColor = (activityText: string, providedColor?: string): string => {
            if (providedColor && providedColor !== 'primary') return providedColor;

            // Check for exact match first
            if (ACTIVITY_COLORS[activityText]) {
                return ACTIVITY_COLORS[activityText];
            }

            // Check for partial match (e.g., "저녁 식사하기" contains "저녁")
            for (const [keyword, colorValue] of Object.entries(ACTIVITY_COLORS)) {
                if (activityText.includes(keyword)) {
                    return colorValue;
                }
            }

            return 'primary'; // Default fallback
        };

        // Create new goal
        const newGoal = {
            id: `ai-${Date.now()}`,
            text,
            time: getTimeOfDay(calculatedStartTime || startTime),
            startTime: calculatedStartTime || startTime,
            endTime: calculatedEndTime || endTime || calculatedStartTime || startTime,
            color: getActivityColor(text, color),
            specificDate: specificDate || undefined,
            daysOfWeek: daysOfWeek || undefined,
            notificationEnabled: true,
        };

        // Add to customGoals
        const updatedCustomGoals = [...customGoals, newGoal];
        const updatedProfile = { ...profile, customGoals: updatedCustomGoals };

        // Save to database
        const { error: updateError } = await supabase
            .from("users")
            .update({ profile: updatedProfile })
            .eq("email", session.user.email);

        if (updateError) {
            console.error("[Schedule Add] Update error:", updateError);
            return NextResponse.json({ error: "Failed to add schedule" }, { status: 500 });
        }

        console.log(`[Schedule Add] Added: ${text} at ${calculatedStartTime || startTime} for ${session.user.email}`);

        return NextResponse.json({
            success: true,
            goal: newGoal,
            message: `"${text}" 일정이 ${calculatedStartTime || startTime}에 추가되었습니다.`,
        });
    } catch (error: any) {
        console.error("[Schedule Add] Error:", error);
        return NextResponse.json({ error: "Failed to add schedule" }, { status: 500 });
    }
}
