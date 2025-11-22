import { Dashboard } from "@/components/features/dashboard/Dashboard";

export default async function DashboardPage() {
    const username = "사용자";

    return (
        <div className="min-h-screen bg-background relative">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent -z-10" />
            <Dashboard username={username} />
        </div>
    );
}
