import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isValidString, isValidTime, isValidDate } from "@/lib/validation";
import { dualWriteAdd } from "@/lib/schedule-dual-write";

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const scheduleData = await request.json();
        const { text, startTime, endTime, color, specificDate, daysOfWeek, findAvailableSlot, estimatedDuration, location, memo, linkedGoalId, linkedGoalType } = scheduleData;

        if (!text || !isValidString(text, 500)) {
            return NextResponse.json(
                { error: "text is required (max 500 characters)" },
                { status: 400 }
            );
        }

        if (startTime && !isValidTime(startTime)) {
            return NextResponse.json({ error: "Invalid startTime format (HH:MM)" }, { status: 400 });
        }
        if (endTime && !isValidTime(endTime)) {
            return NextResponse.json({ error: "Invalid endTime format (HH:MM)" }, { status: 400 });
        }
        if (specificDate && !isValidDate(specificDate)) {
            return NextResponse.json({ error: "Invalid specificDate format (YYYY-MM-DD)" }, { status: 400 });
        }

        // Get current user profile
        const { data: userData, error: fetchError } = await supabaseAdmin
            .from("users")
            .select("profile")
            .eq("email", email)
            .maybeSingle();

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


            // Find next available slot starting from current hour or 9 AM (whichever is later)
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();


            // Start from next half-hour slot after current time, or 9 AM if earlier
            let startHour = currentHour;
            let startMinute = currentMinute < 30 ? 30 : 0;

            // If we're past the half-hour mark, move to next hour
            if (currentMinute >= 30) {
                startHour = currentHour + 1;
                startMinute = 0;
            }

            // But ensure we don't start before 9 AM
            if (startHour < 9) {
                startHour = 9;
                startMinute = 0;
            }


            const endHour = 22;

            let foundSlot = false;
            for (let hour = startHour; hour < endHour; hour++) {
                // For the first hour, start from startMinute; for subsequent hours, start from 0
                const initialMinute = (hour === startHour) ? startMinute : 0;

                for (let minute = initialMinute; minute < 60; minute += 30) { // Check every 30 minutes
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

        }

        // Smart sleep/wake time adjustment
        // 취침 일정인 경우 기상 일정과 연동하여 종료 시간 조정
        const isSleepSchedule = text.includes('취침') || text.toLowerCase().includes('sleep') || text.includes('잠') || text.includes('수면');
        const isWakeSchedule = text.includes('기상') || text.toLowerCase().includes('wake') || text.includes('일어나');

        if (isSleepSchedule && specificDate) {
            // Find wake-up schedule for the same or next day
            const nextDay = new Date(specificDate);
            nextDay.setDate(nextDay.getDate() + 1);
            const nextDayStr = nextDay.toISOString().split('T')[0];

            // Look for wake-up schedule today or tomorrow
            const wakeSchedule = customGoals.find((g: any) => {
                const isWake = g.text?.includes('기상') || g.text?.toLowerCase().includes('wake') || g.text?.includes('일어나');
                const isRelevantDate = g.specificDate === specificDate || g.specificDate === nextDayStr;
                // Also check recurring schedules
                const isRecurringWake = isWake && g.daysOfWeek && g.daysOfWeek.length > 0;
                return isWake && (isRelevantDate || isRecurringWake);
            });

            if (wakeSchedule) {
                // Set sleep end time to wake-up start time
                const wakeTime = wakeSchedule.startTime;
                if (wakeTime && calculatedEndTime) {
                    calculatedEndTime = wakeTime;
                }
            }
        }

        // 기상 일정인 경우 취침 일정의 종료 시간도 맞춰 조정
        // 전날 밤에 시작한 취침 일정도 찾아야 함 (예: 전날 23:00 취침 → 오늘 10:00 기상)
        if (isWakeSchedule && specificDate) {
            // 전날 날짜 계산
            const prevDay = new Date(specificDate);
            prevDay.setDate(prevDay.getDate() - 1);
            const prevDayStr = prevDay.toISOString().split('T')[0];

            // 같은 날 또는 전날의 취침 일정 찾기
            const sleepSchedule = customGoals.find((g: any) => {
                const isSleep = g.text?.includes('취침') || g.text?.toLowerCase().includes('sleep') || g.text?.includes('잠') || g.text?.includes('수면');
                if (!isSleep) return false;

                // 같은 날 취침 (새벽에 잔 경우)
                if (g.specificDate === specificDate) return true;

                // 전날 밤 취침 (저녁/밤에 잔 경우 - 18시 이후 시작)
                if (g.specificDate === prevDayStr && g.startTime) {
                    const startHour = parseInt(g.startTime.split(':')[0]);
                    return startHour >= 18; // 저녁 6시 이후 시작한 취침만
                }

                // 반복 일정 체크
                if (isSleep && g.daysOfWeek && g.daysOfWeek.length > 0) {
                    return true;
                }

                return false;
            });

            if (sleepSchedule && calculatedStartTime) {
                // Update the existing sleep schedule's end time
                const sleepIndex = customGoals.findIndex((g: any) => g.id === sleepSchedule.id);
                if (sleepIndex !== -1) {
                    customGoals[sleepIndex] = {
                        ...customGoals[sleepIndex],
                        endTime: calculatedStartTime
                    };
                }
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
            '게임': 'purple',
            '영화': 'red',
            '드라마': 'amber',
            '음악': 'cyan',
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
        // For recurring schedules (daysOfWeek), set startDate to today so it only shows from today onwards
        const today = new Date().toISOString().split('T')[0];

        const newGoal = {
            id: `ai-${Date.now()}`,
            text,
            time: getTimeOfDay(calculatedStartTime || startTime),
            startTime: calculatedStartTime || startTime,
            endTime: calculatedEndTime || endTime || calculatedStartTime || startTime,
            color: getActivityColor(text, color),
            specificDate: specificDate || undefined,
            daysOfWeek: daysOfWeek || undefined,
            // For recurring schedules, set startDate so they only appear from today onwards
            startDate: daysOfWeek && daysOfWeek.length > 0 ? (specificDate || today) : undefined,
            notificationEnabled: true,
            location: location || undefined,
            memo: memo || undefined,
            // Goal linking
            linkedGoalId: linkedGoalId || undefined,
            linkedGoalType: linkedGoalType || undefined,
        };

        // Add to customGoals
        const updatedCustomGoals = [...customGoals, newGoal];
        const updatedProfile = { ...profile, customGoals: updatedCustomGoals };

        // Save to database
        const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ profile: updatedProfile })
            .eq("email", email);

        if (updateError) {
            console.error("[Schedule Add] Update error:", updateError);
            return NextResponse.json({ error: "Failed to add schedule" }, { status: 500 });
        }


        // Dual-write to schedules table
        await dualWriteAdd(email, newGoal, newGoal.specificDate);

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
