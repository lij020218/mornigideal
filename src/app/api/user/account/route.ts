import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";
import bcrypt from "bcryptjs";
import { accountDeleteSchema, accountUpdateSchema, validateBody } from '@/lib/schemas';

export async function DELETE(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const v = validateBody(accountDeleteSchema, body);
        if (!v.success) return v.response;
        const { password } = v.data;

        // Get user from public.users table (include password for verification)
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("id, password")
            .eq("email", userEmail)
            .maybeSingle();

        if (userError || !userData) {
            console.error("[Account Delete] User not found:", userError);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Verify password (bcrypt only)
        if (userData.password) {
            const isValid = await bcrypt.compare(password, userData.password);
            if (!isValid) {
                return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 403 });
            }
        }

        const userId = userData.id;

        // Delete all user data from various tables
        const deleteTasks: { table: string; filter: { column: string; value: string } }[] = [
            { table: "daily_briefings", filter: { column: "user_id", value: userId } },
            { table: "daily_goals", filter: { column: "user_id", value: userId } },
            { table: "user_curriculum", filter: { column: "user_id", value: userEmail } },
            { table: "user_profiles", filter: { column: "user_id", value: userEmail } },
            { table: "user_subscriptions", filter: { column: "user_id", value: userId } },
            { table: "ai_usage_daily", filter: { column: "user_id", value: userId } },
            { table: "user_memories", filter: { column: "user_id", value: userId } },
            { table: "user_memory", filter: { column: "user_id", value: userId } },
            { table: "user_daily_logs", filter: { column: "user_id", value: userId } },
            { table: "user_events", filter: { column: "user_id", value: userId } },
            { table: "risk_alerts", filter: { column: "user_id", value: userId } },
            { table: "jarvis_notifications", filter: { column: "user_id", value: userId } },
            { table: "learning_progress", filter: { column: "user_id", value: userId } },
            { table: "push_tokens", filter: { column: "user_id", value: userId } },
            { table: "slack_tokens", filter: { column: "user_id", value: userId } },
            { table: "schedule_memos", filter: { column: "user_id", value: userId } },
            { table: "folders", filter: { column: "email", value: userEmail } },
            { table: "gmail_tokens", filter: { column: "user_email", value: userEmail } },
            { table: "schedules", filter: { column: "user_id", value: userEmail } },
        ];

        for (const task of deleteTasks) {
            const { error } = await supabaseAdmin
                .from(task.table)
                .delete()
                .eq(task.filter.column, task.filter.value);
            if (error) console.error(`[Account Delete] Error deleting ${task.table}:`, error);
        }

        // Delete materials (and their storage files)
        const { data: materials } = await supabaseAdmin
            .from("materials")
            .select("id, file_url")
            .eq("user_id", userEmail);

        if (materials && materials.length > 0) {
            for (const material of materials) {
                if (material.file_url) {
                    try {
                        const fileName = material.file_url.split("/").pop();
                        if (fileName) {
                            await supabaseAdmin.storage.from("materials").remove([fileName]);
                        }
                    } catch (storageError) {
                        console.error("[Account Delete] Error deleting storage file:", storageError);
                    }
                }
            }
            await supabaseAdmin.from("materials").delete().eq("user_id", userEmail);
        }

        // Finally, delete the user from public.users
        const { error: deleteUserError } = await supabaseAdmin
            .from("users")
            .delete()
            .eq("id", userId);
        if (deleteUserError) {
            console.error("[Account Delete] Error deleting user:", deleteUserError);
            return NextResponse.json({ error: "Failed to delete user account" }, { status: 500 });
        }


        return NextResponse.json({ success: true, message: "Account deleted successfully" });
    } catch (error: any) {
        console.error("[Account Delete] Error:", error);
        return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const v = validateBody(accountUpdateSchema, body);
        if (!v.success) return v.response;
        const { currentPassword, newPassword } = v.data;

        // Get user
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("id, password")
            .eq("email", userEmail)
            .maybeSingle();

        if (userError || !userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Verify current password (bcrypt only)
        const isValid = await bcrypt.compare(currentPassword, userData.password);

        if (!isValid) {
            return NextResponse.json({ error: "현재 비밀번호가 일치하지 않습니다." }, { status: 403 });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ password: hashedPassword, updated_at: new Date().toISOString() })
            .eq("id", userData.id);

        if (updateError) {
            return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "비밀번호가 변경되었습니다." });
    } catch (error: any) {
        return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
    }
}
