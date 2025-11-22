import { SettingsContent } from "@/components/features/settings/SettingsContent";
import { auth } from "@/auth";

export default async function SettingsPage() {
    const session = await auth();
    const username = session?.user?.username || session?.user?.name || "사용자";
    const email = session?.user?.email || "";

    return (
        <div className="min-h-screen bg-background relative">
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent -z-10" />
            <SettingsContent username={username} email={email} />
        </div>
    );
}
