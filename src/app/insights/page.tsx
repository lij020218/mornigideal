"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TrendBriefingSection } from "@/components/features/dashboard/TrendBriefingSection";
import { TrendBriefingDetail } from "@/components/features/dashboard/TrendBriefingDetail";
import { EmailSummarySection } from "@/components/features/dashboard/EmailSummarySection";

export default function InsightsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [userProfile, setUserProfile] = useState<any>(null);
    const [trendBriefing, setTrendBriefing] = useState<any>(null);
    const [selectedBriefing, setSelectedBriefing] = useState<any>(null);

    // Redirect if not authenticated
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    // Fetch user profile and trend briefings
    useEffect(() => {
        if (!session?.user?.email) return;

        const fetchData = async () => {
            try {
                // Fetch user profile
                const profileRes = await fetch('/api/user/profile');
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    setUserProfile(profileData.profile);

                    // Fetch trend briefings
                    const trendRes = await fetch('/api/trend-briefing-list', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            level: profileData.profile?.level || 'intermediate',
                            job: profileData.profile?.job || '',
                            interests: profileData.profile?.interests || [],
                        }),
                    });

                    if (trendRes.ok) {
                        const trendData = await trendRes.json();
                        setTrendBriefing(trendData);
                    }
                }
            } catch (error) {
                console.error('[Insights] Failed to fetch data:', error);
            }
        };

        fetchData();
    }, [session]);

    if (status === "loading") {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold mb-2">인사이트</h1>
                    <p className="text-muted-foreground">
                        오늘의 트렌드와 중요한 이메일을 확인하세요
                    </p>
                </div>

                {/* Trend Briefing Section */}
                {userProfile && (
                    <TrendBriefingSection
                        job={userProfile.job || ''}
                        goal={userProfile.goal}
                        interests={userProfile.interests || []}
                        onSelectBriefing={(briefing) => setSelectedBriefing(briefing)}
                    />
                )}

                {/* Email Summary Section */}
                <EmailSummarySection />
            </div>

            {/* Trend Briefing Detail Modal */}
            {userProfile && (
                <TrendBriefingDetail
                    briefing={selectedBriefing}
                    isOpen={!!selectedBriefing}
                    onClose={() => setSelectedBriefing(null)}
                    userLevel={userProfile?.level || 'intermediate'}
                    userJob={userProfile?.job || ''}
                />
            )}
        </div>
    );
}
