import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { content, category, relatedGoal, tags } = await request.json();

        if (!content) {
            return NextResponse.json(
                { error: "content is required" },
                { status: 400 }
            );
        }

        // Validate category
        const validCategories = ["insight", "skill", "reflection", "goal_progress"];
        const finalCategory = validCategories.includes(category) ? category : "insight";

        // Get current user profile
        const { data: userData, error: fetchError } = await supabase
            .from("users")
            .select("profile")
            .eq("email", session.user.email)
            .single();

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
        const { error: updateError } = await supabase
            .from("users")
            .update({ profile: updatedProfile })
            .eq("email", session.user.email);

        if (updateError) {
            console.error("[Learning Save] Update error:", updateError);
            return NextResponse.json({ error: "Failed to save learning" }, { status: 500 });
        }

        console.log(`[Learning Save] Saved: "${content.substring(0, 50)}..." (${finalCategory}) for ${session.user.email}`);

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
