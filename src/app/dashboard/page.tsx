import { Dashboard } from "@/components/features/dashboard/Dashboard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await auth();
    const username = session?.user?.username || session?.user?.name || "사용자";

    return (
        <div className="min-h-screen bg-background relative">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent -z-10" />
            <Dashboard username={username} />
        </div>
    );
}
