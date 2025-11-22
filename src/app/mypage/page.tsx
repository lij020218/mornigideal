import { MyPageContent } from "@/components/features/mypage/MyPageContent";
import { auth } from "@/auth";

export default async function MyPage() {
    const session = await auth();
    const username = session?.user?.username || session?.user?.name || "사용자";
    const email = session?.user?.email || "";

    return (
        <div className="min-h-screen bg-background relative">
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent -z-10" />
            <MyPageContent username={username} email={email} />
        </div>
    );
}
