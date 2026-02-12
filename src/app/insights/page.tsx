"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X, Plus } from "lucide-react";
import { TrendBriefingSection } from "@/components/features/dashboard/TrendBriefingSection";
import { TrendBriefingDetail } from "@/components/features/dashboard/TrendBriefingDetail";
import { EmailSummarySection } from "@/components/features/dashboard/EmailSummarySection";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function InsightsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [userProfile, setUserProfile] = useState<any>(null);
    const [trendBriefing, setTrendBriefing] = useState<any>(null);
    const [selectedBriefing, setSelectedBriefing] = useState<any>(null);
    const [newInterest, setNewInterest] = useState("");
    const [isAddingInterest, setIsAddingInterest] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

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
        } catch (error) {
            console.error('[Insights] Failed to save profile to Supabase:', error);
        }
    }, []);

    // Handle adding interest
    const handleAddInterest = useCallback((interest: string) => {
        if (!userProfile) return;

        const currentInterests = userProfile.interests || [];
        if (currentInterests.includes(interest)) {
            return;
        }

        const updatedInterests = [...currentInterests, interest];
        const updatedProfile = { ...userProfile, interests: updatedInterests };

        setUserProfile(updatedProfile);
        localStorage.setItem('user_profile', JSON.stringify(updatedProfile));
        saveProfileToSupabase(updatedProfile);

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

    }, [userProfile, saveProfileToSupabase]);

    // Handle adding interest from input
    const handleAddInterestFromInput = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newInterest.trim();
        if (!trimmed) return;

        // 쉼표로 구분된 여러 관심사 지원
        const interests = trimmed.split(',').map(i => i.trim()).filter(i => i);
        interests.forEach(interest => {
            handleAddInterest(interest);
        });

        setNewInterest("");
        setIsAddingInterest(false);
    }, [newInterest, handleAddInterest]);

    // Focus input when adding interest mode is enabled
    useEffect(() => {
        if (isAddingInterest && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAddingInterest]);

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

                {/* My Interests Section */}
                {userProfile && (
                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card rounded-xl p-4 sm:p-5"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md shadow-amber-500/25">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <h2 className="text-sm sm:text-base font-semibold">내 관심사</h2>
                                <span className="text-xs text-muted-foreground">
                                    ({(userProfile.interests || []).length}개)
                                </span>
                            </div>
                            {!isAddingInterest && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsAddingInterest(true)}
                                    className="h-8 px-3 text-xs bg-muted hover:bg-muted/80 border border-border rounded-full"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                                    추가
                                </Button>
                            )}
                        </div>

                        {/* Interest Input */}
                        <AnimatePresence>
                            {isAddingInterest && (
                                <motion.form
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    onSubmit={handleAddInterestFromInput}
                                    className="mb-3 overflow-hidden"
                                >
                                    <div className="flex gap-2">
                                        <Input
                                            ref={inputRef}
                                            value={newInterest}
                                            onChange={(e) => setNewInterest(e.target.value)}
                                            placeholder="관심사 입력 (쉼표로 여러 개 입력 가능)"
                                            className="h-9 text-sm bg-background border-border flex-1"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape') {
                                                    setIsAddingInterest(false);
                                                    setNewInterest("");
                                                }
                                            }}
                                        />
                                        <Button type="submit" size="sm" className="h-9 px-4">
                                            추가
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 px-2"
                                            onClick={() => {
                                                setIsAddingInterest(false);
                                                setNewInterest("");
                                            }}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1.5">
                                        예: AI, 마케팅, 스타트업, 투자
                                    </p>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        {/* Interest Tags */}
                        <div className="flex flex-wrap gap-2">
                            <AnimatePresence mode="popLayout">
                                {(userProfile.interests || []).length > 0 ? (
                                    (userProfile.interests || []).map((interest: string, idx: number) => (
                                        <motion.span
                                            key={interest}
                                            layout
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            transition={{ duration: 0.2 }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-800 hover:from-amber-100 hover:to-orange-100 transition-all group cursor-default"
                                        >
                                            {interest}
                                            <button
                                                onClick={() => handleRemoveInterest(interest)}
                                                className="opacity-60 group-hover:opacity-100 hover:text-red-500 transition-all"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </motion.span>
                                    ))
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center gap-2 text-sm text-muted-foreground py-2"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-dashed border-border">
                                            <Plus className="w-4 h-4" />
                                        </div>
                                        <span className="italic">관심사를 추가하면 맞춤형 트렌드를 받아볼 수 있어요</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.section>
                )}

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
