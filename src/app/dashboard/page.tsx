import { Dashboard } from "@/components/features/dashboard/Dashboard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCachedUser, getCachedMaterials, getCachedCurriculum, getCachedTrendBriefing } from "@/lib/data-service";

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/login");
    }

    const username = session?.user?.username || session?.user?.name || "사용자";
    const email = session.user.email;

    // Fetch all data in parallel
    const [user, materials, trendBriefing] = await Promise.all([
        getCachedUser(),
        getCachedMaterials(email),
        getCachedTrendBriefing(email)
    ]);

    // Curriculum needs user ID, so we use the user object fetched above
    const curriculum = user ? await getCachedCurriculum(user.id) : [];

    return (
        <div className="min-h-screen bg-background relative">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent -z-10" />
            <Dashboard
                username={username}
                initialProfile={user?.profile || null}
                initialMaterials={materials}
                initialCurriculum={curriculum}
                initialTrendBriefing={trendBriefing}
            />
        </div>
    );
}
