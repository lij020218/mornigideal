import { Dashboard } from "@/components/features/dashboard/Dashboard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCachedUser, getCachedMaterials, getCachedCurriculum, getCachedTrendBriefing, getCachedRecommendations } from "@/lib/data-service";
import { Suspense } from "react";
import { FloatingAIAssistant } from "@/components/ui/FloatingAIAssistant";

// Mark page as dynamic to enable streaming
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/login");
    }

    const username = session?.user?.username || session?.user?.name || "사용자";
    const email = session.user.email;

    // Fetch critical data first (user profile is needed for everything)
    const user = await getCachedUser();

    // Start all other fetches in parallel without awaiting
    const materialsPromise = getCachedMaterials(email);
    const curriculumPromise = user ? getCachedCurriculum(user.id) : Promise.resolve([]);
    const trendBriefingPromise = getCachedTrendBriefing(email);
    const recommendationsPromise = getCachedRecommendations(email);

    // Await only the essential data needed for initial render
    const [materials, curriculum, recommendations] = await Promise.all([
        materialsPromise,
        curriculumPromise,
        recommendationsPromise
    ]);

    // Trend briefing can load later without blocking
    const trendBriefing = await trendBriefingPromise;

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

