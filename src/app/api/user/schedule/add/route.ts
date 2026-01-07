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

            // Parse estimated duration (e.g., "30분" -> 30, "1시간" -> 60, "1시간 30분" -> 90)
            let durationMinutes = 60; // default
            if (estimatedDuration) {
                const hourMatch = estimatedDuration.match(/(\d+)\s*시간/);
                const minuteMatch = estimatedDuration.match(/(\d+)\s*분/);

                const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
                const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;

                durationMinutes = (hours * 60) + minutes;

                // If no matches found, try just parsing the number
                if (durationMinutes === 0) {
                    durationMinutes = parseInt(estimatedDuration) || 60;
                }
            }

            console.log(`[Schedule Add] Parsed duration: ${durationMinutes} minutes from "${estimatedDuration}"`);

            // Find next available slot starting from current hour or 9 AM (whichever is later)
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const startHour = Math.max(currentHour + (currentMinute >= 30 ? 1 : 0), 9);
            const endHour = 22;

            let foundSlot = false;
            for (let hour = startHour; hour < endHour; hour++) {
                for (let minute = 0; minute < 60; minute += 30) { // Check every 30 minutes
                    const slotStart = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

                    // Calculate end time based on actual duration
                    const endTotalMinutes = (hour * 60) + minute + durationMinutes;
                    const slotEndHour = Math.floor(endTotalMinutes / 60);
                    const slotEndMinute = endTotalMinutes % 60;
                    const slotEnd = `${slotEndHour.toString().padStart(2, '0')}:${slotEndMinute.toString().padStart(2, '0')}`;

                    if (slotEndHour >= endHour) continue;

                    // Check if this slot conflicts with existing schedules
                    const hasConflict = todaySchedules.some((schedule: any) => {
                        const [schedStartH, schedStartM] = schedule.startTime.split(':').map(Number);
                        const [schedEndH, schedEndM] = schedule.endTime.split(':').map(Number);
                        const scheduleStartMinutes = schedStartH * 60 + schedStartM;
                        const scheduleEndMinutes = schedEndH * 60 + schedEndM;
                        const slotStartMinutes = hour * 60 + minute;

                        return (slotStartMinutes < scheduleEndMinutes && endTotalMinutes > scheduleStartMinutes);
                    });

                    if (!hasConflict) {
                        calculatedStartTime = slotStart;
                        calculatedEndTime = slotEnd;
                        foundSlot = true;
                        break;
                    }
                }
                if (foundSlot) break;
            }

            // If no slot found, default to end of day
            if (!foundSlot) {
                calculatedStartTime = "20:00";
                const defaultEndMinutes = 20 * 60 + durationMinutes;
                const defaultEndHour = Math.floor(defaultEndMinutes / 60);
                const defaultEndMinute = defaultEndMinutes % 60;
                calculatedEndTime = `${defaultEndHour.toString().padStart(2, '0')}:${defaultEndMinute.toString().padStart(2, '0')}`;
            }

            console.log(`[Schedule Add] Slot found: ${calculatedStartTime} - ${calculatedEndTime} (${durationMinutes} min)`);
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
            // Smart suggestions colors (bright colors)
            '거북목': 'pink',
            '산책': 'green',
            '스타트업': 'purple',
            '린 스타트업': 'purple',
            '읽기': 'cyan',
            '책': 'cyan',
            'AI': 'indigo',
            'MVP': 'purple',
            '알고리즘': 'blue',
            '프로젝트': 'purple',
            '캠페인': 'orange',
            '분석': 'blue',
            '콘텐츠': 'amber',
            '기획': 'amber',
            '학습': 'indigo',
            '실습': 'blue',
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
