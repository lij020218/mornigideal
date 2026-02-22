import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { learningSaveSchema, validateBody } from '@/lib/schemas';

export async function POST(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const v = validateBody(learningSaveSchema, body);
        if (!v.success) return v.response;
        const { content, relatedGoal, tags } = v.data;
        const finalCategory = v.data.category || "insight";

        // Get current user profile
        const { data: userData, error: fetchError } = await supabaseAdmin
            .from("users")
            .select("profile")
            .eq("email", userEmail)
            .maybeSingle();

        if (fetchError || !userData) {
            console.error("[Learning Save] Fetch error:", fetchError);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const profile = userData.profile || {};
        const learnings = profile.learnings || [];

        // Create new learning entry
        const today = new Date().toISOString().split('T')[0];
        const newLearning = {
            id: `learning-${Date.now()}`,
            content,
            category: finalCategory,
            relatedGoal: relatedGoal || null,
            tags: tags || [],
            date: today,
            createdAt: new Date().toISOString(),
        };

        // Add to learnings
        const updatedLearnings = [...learnings, newLearning];
        const updatedProfile = { ...profile, learnings: updatedLearnings };

        // Save to database
        const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ profile: updatedProfile })
            .eq("email", userEmail);

        if (updateError) {
            console.error("[Learning Save] Update error:", updateError);
            return NextResponse.json({ error: "Failed to save learning" }, { status: 500 });
        }


        // Category labels for response
        const categoryLabels: Record<string, string> = {
            insight: "인사이트",
            skill: "스킬",
            reflection: "회고",
            goal_progress: "목표 진행",
        };

        return NextResponse.json({
            success: true,
            learning: newLearning,
            message: `${categoryLabels[finalCategory]} 기록이 저장되었습니다.`,
        });
    } catch (error: any) {
        console.error("[Learning Save] Error:", error);
        return NextResponse.json({ error: "Failed to save learning" }, { status: 500 });
    }
}
