import { Dashboard } from "@/components/features/dashboard/Dashboard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCachedUser, getCachedMaterials, getCachedCurriculum, getCachedTrendBriefing, getCachedRecommendations, getCachedHabitInsights } from "@/lib/data-service";
import { Suspense } from "react";
import { FloatingAIAssistant } from "@/components/ui/FloatingAIAssistant";

// Enable static optimization with revalidation
export const revalidate = 60; // Revalidate every 60 seconds

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/login");
    }

    const username = session?.user?.username || session?.user?.name || "사용자";
    const email = session.user.email;

    // Fetch all data in parallel for fast loading
    const [user, materials, curriculum, trendBriefing, habitInsights] = await Promise.all([
        getCachedUser(),
        getCachedMaterials(email),
        getCachedCurriculum(email),
        getCachedTrendBriefing(email),
        getCachedHabitInsights(email)
    ]);

    return (
        <div className="min-h-screen bg-background relative md:ml-20">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent -z-10" />
            <Dashboard
                username={username}
                initialProfile={user?.profile || null}
                initialMaterials={materials}
                initialCurriculum={curriculum}
                initialTrendBriefing={trendBriefing}
                initialHabitInsights={habitInsights}
            />
            <FloatingAIAssistant
                showSuggestions={true}
                briefings={[]}
                recommendations={[]}
                userProfile={user?.profile ? {
                    job: user.profile.job,
                    goal: user.profile.goal,
                    customGoals: user.profile.customGoals
                } : undefined}
            />
        </div>
    );
}

