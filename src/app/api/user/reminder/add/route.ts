import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { reminderAddSchema, validateBody } from '@/lib/schemas';

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const v = validateBody(reminderAddSchema, body);
        if (!v.success) return v.response;
        const { targetTime, message, relatedSchedule, specificDate } = v.data;

        // Get current user profile
        const { data: userData, error: fetchError } = await supabaseAdmin
            .from("users")
            .select("profile")
            .eq("email", email)
            .maybeSingle();

        if (fetchError || !userData) {
            console.error("[Reminder Add] Fetch error:", fetchError);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const profile = userData.profile || {};
        const reminders = profile.reminders || [];

        // Create new reminder
        const today = new Date().toISOString().split('T')[0];
        const newReminder = {
            id: `reminder-${Date.now()}`,
            targetTime,
            message,
            relatedSchedule: relatedSchedule || null,
            specificDate: specificDate || today,
            createdAt: new Date().toISOString(),
            notified: false,
        };

        // Add to reminders
        const updatedReminders = [...reminders, newReminder];
        const updatedProfile = { ...profile, reminders: updatedReminders };

        // Save to database
        const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ profile: updatedProfile })
            .eq("email", email);

        if (updateError) {
            console.error("[Reminder Add] Update error:", updateError);
            return NextResponse.json({ error: "Failed to add reminder" }, { status: 500 });
        }


        return NextResponse.json({
            success: true,
            reminder: newReminder,
            message: `리마인더가 ${targetTime}에 설정되었습니다.`,
        });
    } catch (error: any) {
        console.error("[Reminder Add] Error:", error);
        return NextResponse.json({ error: "Failed to add reminder" }, { status: 500 });
    }
}
