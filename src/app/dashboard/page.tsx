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

    // Fetch only critical user data immediately
    const user = await getCachedUser();

    // All other data fetches - don't await, let them load in parallel
    const materialsPromise = getCachedMaterials(email);
    const curriculumPromise = user ? getCachedCurriculum(user.id) : Promise.resolve([]);
    const trendBriefingPromise = getCachedTrendBriefing(email);
    const recommendationsPromise = getCachedRecommendations(email);
    const habitInsightsPromise = getCachedHabitInsights(email);

    // Resolve all data in parallel
    const [materials, curriculum, trendBriefing, recommendations, habitInsights] = await Promise.all([
        materialsPromise,
        curriculumPromise,
        trendBriefingPromise,
        recommendationsPromise,
        habitInsightsPromise
    ]);

    return (
        <div className="min-h-screen bg-background relative">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent -z-10" />
            <Dashboard
                username={username}
                initialProfile={user?.profile || null}
                initialMaterials={materials}
                initialCurriculum={curriculum as any}
                initialTrendBriefing={trendBriefing}
                initialHabitInsights={habitInsights}
            />
            {/* Floating AI Assistant with suggestions on dashboard */}
            <FloatingAIAssistant
                showSuggestions={true}
                briefings={trendBriefing || []}
                recommendations={recommendations?.recommendations || []}
                userProfile={user?.profile ? {
                    job: user.profile.job,
                    goal: user.profile.goal,
                    customGoals: user.profile.customGoals
                } : undefined}
            />
        </div>
    );
}

