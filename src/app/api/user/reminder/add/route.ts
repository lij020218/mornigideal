import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { targetTime, message, relatedSchedule, specificDate } = await request.json();

        if (!targetTime || !message) {
            return NextResponse.json(
                { error: "targetTime and message are required" },
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
        const { error: updateError } = await supabase
            .from("users")
            .update({ profile: updatedProfile })
            .eq("email", session.user.email);

        if (updateError) {
            console.error("[Reminder Add] Update error:", updateError);
            return NextResponse.json({ error: "Failed to add reminder" }, { status: 500 });
        }

        console.log(`[Reminder Add] Added: "${message}" at ${targetTime} for ${session.user.email}`);

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
