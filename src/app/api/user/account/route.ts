import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { password } = await request.json();

        if (!password) {
            return NextResponse.json({ error: "Password is required" }, { status: 400 });
        }

        const userEmail = session.user.email;
        console.log(`[Account Delete] Starting account deletion for: ${userEmail}`);

        // Get user ID from public.users table
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", userEmail)
            .single();

        if (userError || !userData) {
            console.error("[Account Delete] User not found:", userError);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const userId = userData.id;
        console.log(`[Account Delete] Found user ID: ${userId}`);

        // Delete all user data from various tables
        // Order matters due to foreign key constraints

        // 1. Delete daily briefings
        const { error: briefingError } = await supabaseAdmin
            .from("daily_briefings")
            .delete()
            .eq("user_id", userId);
        if (briefingError) console.error("[Account Delete] Error deleting briefings:", briefingError);

        // 2. Delete daily goals
        const { error: goalsError } = await supabaseAdmin
            .from("daily_goals")
            .delete()
            .eq("user_id", userId);
        if (goalsError) console.error("[Account Delete] Error deleting goals:", goalsError);

        // 3. Delete user curriculum
        const { error: curriculumError } = await supabaseAdmin
            .from("user_curriculum")
            .delete()
            .eq("user_id", userEmail);
        if (curriculumError) console.error("[Account Delete] Error deleting curriculum:", curriculumError);

        // 4. Delete user profile
        const { error: profileError } = await supabaseAdmin
            .from("user_profiles")
            .delete()
            .eq("user_id", userEmail);
        if (profileError) console.error("[Account Delete] Error deleting profile:", profileError);

        // 5. Delete materials (and their storage files)
        const { data: materials } = await supabaseAdmin
            .from("materials")
            .select("id, file_url")
            .eq("user_id", userEmail);

        if (materials && materials.length > 0) {
            // Delete storage files
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

            // Delete material records
            const { error: materialsError } = await supabaseAdmin
                .from("materials")
                .delete()
                .eq("user_id", userEmail);
            if (materialsError) console.error("[Account Delete] Error deleting materials:", materialsError);
        }

        // 6. Delete folders
        const { error: foldersError } = await supabaseAdmin
            .from("folders")
            .delete()
            .eq("email", userEmail);
        if (foldersError) console.error("[Account Delete] Error deleting folders:", foldersError);

        // 7. Delete gmail tokens
        const { error: tokensError } = await supabaseAdmin
            .from("gmail_tokens")
            .delete()
            .eq("user_email", userEmail);
        if (tokensError) console.error("[Account Delete] Error deleting gmail tokens:", tokensError);

        // 8. Delete schedules
        const { error: schedulesError } = await supabaseAdmin
            .from("schedules")
            .delete()
            .eq("user_id", userEmail);
        if (schedulesError) console.error("[Account Delete] Error deleting schedules:", schedulesError);

        // 9. Finally, delete the user from public.users
        const { error: deleteUserError } = await supabaseAdmin
            .from("users")
            .delete()
            .eq("id", userId);
        if (deleteUserError) {
            console.error("[Account Delete] Error deleting user:", deleteUserError);
            return NextResponse.json({ error: "Failed to delete user account" }, { status: 500 });
        }

        console.log(`[Account Delete] Successfully deleted account for: ${userEmail}`);

        return NextResponse.json({ success: true, message: "Account deleted successfully" });
    } catch (error: any) {
        console.error("[Account Delete] Error:", error);
        return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }
}
