import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { scheduleModifySchema, validateBody } from '@/lib/schemas';
import { dualWriteModify } from "@/lib/schedule-dual-write";

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const v = validateBody(scheduleModifySchema, body);
        if (!v.success) return v.response;
        const {
            scheduleId,
            originalText,
            originalTime,
            newText,
            newStartTime,
            newEndTime,
            newLocation,
            newMemo,
        } = v.data;

        // Get current user profile
        const { data: userData, error: fetchError } = await supabaseAdmin
            .from("users")
            .select("profile")
            .eq("email", email)
            .maybeSingle();

        if (fetchError || !userData) {
            console.error("[Schedule Modify] Fetch error:", fetchError);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const profile = userData.profile || {};
        const customGoals = profile.customGoals || [];

        // Find the schedule to modify
        let scheduleIndex = -1;

        if (scheduleId) {
            // Find by ID
            scheduleIndex = customGoals.findIndex((g: any) => g.id === scheduleId);
        } else {
            // Find by text and time (approximate match)
            scheduleIndex = customGoals.findIndex((g: any) => {
                const textMatch = g.text?.toLowerCase().includes(originalText!.toLowerCase()) ||
                    originalText!.toLowerCase().includes(g.text?.toLowerCase());
                const timeMatch = !originalTime || g.startTime === originalTime;
                return textMatch && timeMatch;
            });
        }

        if (scheduleIndex === -1) {
            return NextResponse.json(
                { error: "Schedule not found", details: `Could not find schedule: ${originalText}` },
                { status: 404 }
            );
        }

        const existingSchedule = customGoals[scheduleIndex];

        // Create updated schedule
        const updatedSchedule = {
            ...existingSchedule,
            ...(newText && { text: newText }),
            ...(newStartTime && { startTime: newStartTime }),
            ...(newEndTime && { endTime: newEndTime }),
            ...(newLocation !== undefined && { location: newLocation }),
            ...(newMemo !== undefined && { memo: newMemo }),
            updatedAt: new Date().toISOString(),
        };

        // If start time changed, update time of day
        if (newStartTime) {
            const hour = parseInt(newStartTime.split(":")[0]);
            updatedSchedule.time = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
        }

        // Update in array
        customGoals[scheduleIndex] = updatedSchedule;
        const updatedProfile = { ...profile, customGoals };

        // Save to database
        const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ profile: updatedProfile })
            .eq("email", email);

        if (updateError) {
            console.error("[Schedule Modify] Update error:", updateError);
            return NextResponse.json({ error: "Failed to modify schedule" }, { status: 500 });
        }


        // Dual-write to schedules table
        const sid = scheduleId || existingSchedule.id;
        if (sid) {
            await dualWriteModify(email, sid, {
                text: newText,
                startTime: newStartTime,
                endTime: newEndTime,
                location: newLocation,
                memo: newMemo,
            });
        }

        return NextResponse.json({
            success: true,
            schedule: updatedSchedule,
            message: `일정이 수정되었습니다.`,
        });
    } catch (error: any) {
        console.error("[Schedule Modify] Error:", error);
        return NextResponse.json({ error: "Failed to modify schedule" }, { status: 500 });
    }
}
