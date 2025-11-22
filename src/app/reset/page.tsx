"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetPage() {
    const router = useRouter();

    useEffect(() => {
        // Clear all localStorage
        localStorage.clear();

        // Redirect to onboarding
        setTimeout(() => {
            router.push("/onboarding");
        }, 1000);
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">데이터 초기화 중...</h2>
                <p className="text-muted-foreground">온보딩 페이지로 이동합니다.</p>
            </div>
        </div>
    );
}
