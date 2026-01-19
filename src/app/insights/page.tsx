"use client";

import { useEffect, useState, useCallback } from "react";
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

    // Save profile to database
    const saveProfileToSupabase = useCallback(async (profile: any) => {
        try {
            await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile }),
            });
            console.log('[Insights] Profile saved to Supabase');
        } catch (error) {
            console.error('[Insights] Failed to save profile to Supabase:', error);
        }
    }, []);

    // Handle adding interest
    const handleAddInterest = useCallback((interest: string) => {
        if (!userProfile) return;

        const currentInterests = userProfile.interests || [];
        if (currentInterests.includes(interest)) {
            console.log('[Insights] Interest already exists:', interest);
            return;
        }

        const updatedInterests = [...currentInterests, interest];
        const updatedProfile = { ...userProfile, interests: updatedInterests };

        setUserProfile(updatedProfile);
        localStorage.setItem('user_profile', JSON.stringify(updatedProfile));
        saveProfileToSupabase(updatedProfile);

        console.log('[Insights] Interest added:', interest);
    }, [userProfile, saveProfileToSupabase]);

    // Handle removing interest
    const handleRemoveInterest = useCallback((interest: string) => {
        if (!userProfile) return;

        const currentInterests = userProfile.interests || [];
        const updatedInterests = currentInterests.filter((i: string) => i !== interest);
        const updatedProfile = { ...userProfile, interests: updatedInterests };

        setUserProfile(updatedProfile);
        localStorage.setItem('user_profile', JSON.stringify(updatedProfile));
        saveProfileToSupabase(updatedProfile);

        console.log('[Insights] Interest removed:', interest);
    }, [userProfile, saveProfileToSupabase]);

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
                    const params = new URLSearchParams({
                        job: profileData.profile?.job || 'Professional',
                        goal: profileData.profile?.goal || '',
                        interests: (profileData.profile?.interests || []).join(','),
                    });

                    const trendRes = await fetch(`/api/trend-briefing?${params.toString()}`);

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
            <div className="h-screen flex items-center justify-center md:ml-20">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background md:ml-20">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-16 sm:pt-20 md:pt-8 pb-6 sm:pb-8 space-y-4 sm:space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">인사이트</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
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
                        onAddInterest={handleAddInterest}
                        onRemoveInterest={handleRemoveInterest}
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
