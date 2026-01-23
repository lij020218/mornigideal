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
        <div className="min-h-screen bg-gradient-mesh relative md:ml-20 overflow-hidden">
            {/* Animated Gradient Orbs - Warm Amber */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="gradient-orb gradient-orb-amber w-[500px] h-[500px] -top-48 -left-24 animate-blob" />
                <div className="gradient-orb gradient-orb-orange w-[400px] h-[400px] top-1/3 -right-32 animate-blob animation-delay-2000" />
                <div className="gradient-orb gradient-orb-yuzu w-[350px] h-[350px] bottom-0 left-1/4 animate-blob animation-delay-4000" />
            </div>
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
            />
        </div>
    );
}

