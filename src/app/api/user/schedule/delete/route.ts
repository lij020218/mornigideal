import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from '@/lib/logger';
import { supabaseAdmin } from "@/lib/supabase-admin";
import { scheduleDeleteSchema, validateBody } from '@/lib/schemas';
import { dualWriteDelete } from "@/lib/schedule-dual-write";

export const POST = withAuth(async (request: NextRequest, email: string) => {
        const body = await request.json();
        const v = validateBody(scheduleDeleteSchema, body);
        if (!v.success) return v.response;
        const { scheduleId, text, startTime, isRepeating, specificDate } = v.data;

        // Get current user profile
        const { data: userData, error: fetchError } = await supabaseAdmin
            .from("users")
            .select("profile")
            .eq("email", email)
            .maybeSingle();

        if (fetchError || !userData) {
            logger.error("[Schedule Delete] Fetch error:", fetchError);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const profile = userData.profile || {};
        const customGoals = profile.customGoals || [];

        // Find the schedule to delete
        let scheduleIndex = -1;

        if (scheduleId) {
            // Find by ID (exact match)
            scheduleIndex = customGoals.findIndex((g: any) => g.id === scheduleId);
        } else {
            // Find by text and time (approximate match)
            scheduleIndex = customGoals.findIndex((g: any) => {
                // Text match (case-insensitive, partial match)
                const textMatch = g.text?.toLowerCase().includes(text!.toLowerCase()) ||
                    text!.toLowerCase().includes(g.text?.toLowerCase());

                // Time match (if provided)
                const timeMatch = !startTime || g.startTime === startTime;

                // Date match (for specific date schedules)
                const dateMatch = !specificDate || g.specificDate === specificDate;

                // Repeating match
                const repeatingMatch = isRepeating === undefined ||
                    (isRepeating && g.daysOfWeek && g.daysOfWeek.length > 0) ||
                    (!isRepeating && !g.daysOfWeek);

                return textMatch && timeMatch && dateMatch && repeatingMatch;
            });
        }

        if (scheduleIndex === -1) {
            return NextResponse.json(
                { error: "Schedule not found", details: `Could not find schedule: ${text}` },
                { status: 404 }
            );
        }

        const deletedSchedule = customGoals[scheduleIndex];

        // Remove from array
        const updatedCustomGoals = customGoals.filter((_: any, idx: number) => idx !== scheduleIndex);
        const updatedProfile = { ...profile, customGoals: updatedCustomGoals };

        // Save to database
        const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ profile: updatedProfile })
            .eq("email", email);

        if (updateError) {
            logger.error("[Schedule Delete] Update error:", updateError);
            return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
        }


        // Dual-write to schedules table
        const sid = scheduleId || deletedSchedule.id;
        if (sid) {
            await dualWriteDelete(email, sid);
        }

        return NextResponse.json({
            success: true,
            deleted: deletedSchedule,
            message: `"${deletedSchedule.text}" 일정이 삭제되었습니다.`,
        });
});
