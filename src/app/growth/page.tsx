"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, BookOpen, LineChart, Target, Plus, GraduationCap, Crown, Star, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SmartInsightsWidget } from "@/components/features/dashboard/SmartInsightsWidget";
import { LongTermGoalsWidget } from "@/components/features/goals/LongTermGoalsWidget";
import { GoalSettingModal } from "@/components/features/goals/GoalSettingModal";
import {
    LearningCurriculumWizard,
    LearningCurriculumView,
    SlideViewer,
} from "@/components/features/learning";
import { cn } from "@/lib/utils";

interface CurriculumDay {
    day: number;
    title: string;
    description: string;
    objectives: string[];
    estimatedMinutes: number;
}

interface Curriculum {
    id: string;
    topic: string;
    reason: string;
    targetLevel: string;
    currentLevel: string;
    duration: number;
    days: CurriculumDay[];
    createdAt: string;
    hasSlides: boolean;
}

const LEVEL_LABELS: Record<string, string> = {
    beginner: "입문",
    basic: "기초",
    intermediate: "중급",
    advanced: "고급",
    expert: "전문가",
};

export default function GrowthPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [habitInsights, setHabitInsights] = useState<any>(null);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [goalsKey, setGoalsKey] = useState(0);

    // Learning states
    const [userPlan, setUserPlan] = useState<"standard" | "pro" | "max">("standard");
    const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
    const [selectedCurriculum, setSelectedCurriculum] = useState<Curriculum | null>(null);
    const [showCurriculumWizard, setShowCurriculumWizard] = useState(false);
    const [isLoadingCurriculums, setIsLoadingCurriculums] = useState(true);
    const [slideViewerData, setSlideViewerData] = useState<{
        curriculum: Curriculum;
        day: CurriculumDay;
    } | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    useEffect(() => {
        if (!session?.user?.email) return;

        const fetchData = async () => {
            try {
                // Fetch habit insights
                const insightsRes = await fetch('/api/habit-insights');
                if (insightsRes.ok) {
                    const insightsData = await insightsRes.json();
                    setHabitInsights(insightsData);
                }

                // Fetch user profile for plan info
                const profileRes = await fetch('/api/user/profile');
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    setUserPlan(profileData.profile?.plan || "standard");
                }

                // Fetch curriculums from DB
                const curriculumsRes = await fetch('/api/ai-learning-curriculum');
                if (curriculumsRes.ok) {
                    const curriculumsData = await curriculumsRes.json();
                    const dbCurriculums = curriculumsData.curriculums?.map((c: any) => c.curriculum_data) || [];

                    if (dbCurriculums.length > 0) {
                        setCurriculums(dbCurriculums);
                        // DB 데이터를 localStorage에 백업
                        localStorage.setItem('learning_curriculums_backup', JSON.stringify(dbCurriculums));
                    } else {
                        // DB에 없으면 localStorage에서 복구 시도
                        const backupData = localStorage.getItem('learning_curriculums_backup');
                        if (backupData) {
                            try {
                                const parsedBackup = JSON.parse(backupData);
                                setCurriculums(parsedBackup);
                                console.log('[Growth] Restored curriculums from localStorage backup');
                            } catch (e) {
                                console.error('[Growth] Failed to parse backup:', e);
                            }
                        }
                    }
                } else {
                    // API 실패 시 localStorage에서 복구 시도
                    const backupData = localStorage.getItem('learning_curriculums_backup');
                    if (backupData) {
                        try {
                            const parsedBackup = JSON.parse(backupData);
                            setCurriculums(parsedBackup);
                            console.log('[Growth] Restored curriculums from localStorage backup (API failed)');
                        } catch (e) {
                            console.error('[Growth] Failed to parse backup:', e);
                        }
                    }
                }
            } catch (error) {
                console.error('[Growth] Failed to fetch data:', error);
                // 오류 발생 시 localStorage에서 복구 시도
                const backupData = localStorage.getItem('learning_curriculums_backup');
                if (backupData) {
                    try {
                        const parsedBackup = JSON.parse(backupData);
                        setCurriculums(parsedBackup);
                        console.log('[Growth] Restored curriculums from localStorage backup (error)');
                    } catch (e) {
                        console.error('[Growth] Failed to parse backup:', e);
                    }
                }
            } finally {
                setIsLoadingCurriculums(false);
            }
        };

        fetchData();
    }, [session]);

    const handleScheduleAdd = async (newSchedules: any[]) => {
        try {
            // Get current profile
            const profileRes = await fetch('/api/user/profile');
            if (!profileRes.ok) return;

            const { profile } = await profileRes.json();
            const currentGoals = profile?.customGoals || [];

            // Add new schedules
            const updatedGoals = [...currentGoals, ...newSchedules];

            // Save to profile
            await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customGoals: updatedGoals,
                }),
            });

            console.log('[Growth] Added goal-based schedules:', newSchedules);
        } catch (error) {
            console.error('[Growth] Failed to add schedules:', error);
        }
    };

    const handleCurriculumComplete = (curriculum: Curriculum) => {
        const updatedCurriculums = [curriculum, ...curriculums];
        setCurriculums(updatedCurriculums);
        setShowCurriculumWizard(false);
        setSelectedCurriculum(curriculum);

        // localStorage에 백업 저장
        localStorage.setItem('learning_curriculums_backup', JSON.stringify(updatedCurriculums));
    };

    const handleStartDay = (day: CurriculumDay, withSlides: boolean) => {
        if (withSlides && selectedCurriculum) {
            setSlideViewerData({
                curriculum: selectedCurriculum,
                day,
            });
        } else {
            // Just mark as started - could open a simple day view
            console.log('[Growth] Starting day:', day);
        }
    };

    const handleSlideComplete = () => {
        setSlideViewerData(null);
        // Refresh curriculum view to show updated progress
    };

    if (status === "loading") {
        return (
            <div className="h-screen flex items-center justify-center md:ml-20">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background md:ml-20">
            <div className="max-w-7xl mx-auto px-6 pt-20 md:pt-8 pb-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">성장</h1>
                    <p className="text-muted-foreground">
                        학습 자료와 성장 분석을 확인하세요
                    </p>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="goals" className="space-y-6">
                    <TabsList className="grid w-full max-w-lg grid-cols-3">
                        <TabsTrigger value="goals" className="flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            목표
                        </TabsTrigger>
                        <TabsTrigger value="learning" className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            학습
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="flex items-center gap-2">
                            <LineChart className="w-4 h-4" />
                            분석
                        </TabsTrigger>
                    </TabsList>

                    {/* Goals Tab */}
                    <TabsContent value="goals" className="space-y-6">
                        <LongTermGoalsWidget
                            key={goalsKey}
                            onOpenGoalModal={() => setShowGoalModal(true)}
                        />
                    </TabsContent>

                    {/* Learning Tab */}
                    <TabsContent value="learning" className="space-y-6">
                        {selectedCurriculum ? (
                            <LearningCurriculumView
                                curriculum={selectedCurriculum}
                                userPlan={userPlan}
                                onClose={() => setSelectedCurriculum(null)}
                                onStartDay={handleStartDay}
                            />
                        ) : (
                            <div className="space-y-6">
                                {/* Plan Badge */}
                                <div className={cn(
                                    "flex items-center justify-between p-4 rounded-xl",
                                    userPlan === "max"
                                        ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20"
                                        : userPlan === "pro"
                                        ? "bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20"
                                        : "bg-white/[0.03] border border-border/50"
                                )}>
                                    <div className="flex items-center gap-3">
                                        {userPlan === "max" ? (
                                            <Crown className="w-5 h-5 text-amber-400" />
                                        ) : userPlan === "pro" ? (
                                            <Star className="w-5 h-5 text-purple-400" />
                                        ) : (
                                            <Zap className="w-5 h-5 text-blue-400" />
                                        )}
                                        <div>
                                            <p className="font-medium text-sm">
                                                {userPlan === "max" ? "Max 플랜" : userPlan === "pro" ? "Pro 플랜" : "Standard 플랜"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {userPlan === "max"
                                                    ? "AI 커리큘럼 + 15쪽 학습 슬라이드 제공"
                                                    : "AI 맞춤 커리큘럼 제공"
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => setShowCurriculumWizard(true)}
                                        size="sm"
                                        className="gap-2 rounded-xl"
                                    >
                                        <Plus className="w-4 h-4" />
                                        새 커리큘럼
                                    </Button>
                                </div>

                                {/* Curriculum List */}
                                {isLoadingCurriculums ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    </div>
                                ) : curriculums.length === 0 ? (
                                    <div className="text-center py-16 bg-white/[0.02] rounded-2xl">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                            <GraduationCap className="w-8 h-8 text-purple-400" />
                                        </div>
                                        <h3 className="text-lg font-semibold mb-2">맞춤형 학습을 시작하세요</h3>
                                        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                                            배우고 싶은 분야와 목표를 알려주시면 AI가 맞춤형 커리큘럼을 만들어 드려요
                                        </p>
                                        <Button
                                            onClick={() => setShowCurriculumWizard(true)}
                                            className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                        >
                                            <GraduationCap className="w-4 h-4" />
                                            학습 시작하기
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {curriculums.map((curriculum) => (
                                            <button
                                                key={curriculum.id}
                                                onClick={() => setSelectedCurriculum(curriculum)}
                                                className="p-5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-all text-left border border-transparent hover:border-purple-500/30"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                                                        <GraduationCap className="w-6 h-6 text-purple-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-semibold">{curriculum.topic}</h3>
                                                            {curriculum.hasSlides && (
                                                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center gap-1">
                                                                    <Crown className="w-3 h-3" />
                                                                    슬라이드
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                                                            {curriculum.reason}
                                                        </p>
                                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                            <span>
                                                                {LEVEL_LABELS[curriculum.currentLevel]} → {LEVEL_LABELS[curriculum.targetLevel]}
                                                            </span>
                                                            <span>{curriculum.duration}일 과정</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    {/* Analytics Tab */}
                    <TabsContent value="analytics" className="space-y-6">
                        <SmartInsightsWidget
                            customGoals={[]}
                            currentTime={new Date()}
                            initialHabitInsights={habitInsights}
                        />
                    </TabsContent>
                </Tabs>

                {/* Goal Setting Modal */}
                <GoalSettingModal
                    isOpen={showGoalModal}
                    onClose={() => setShowGoalModal(false)}
                    onGoalsUpdated={() => setGoalsKey(k => k + 1)}
                    onScheduleAdd={handleScheduleAdd}
                />

                {/* Learning Curriculum Wizard */}
                <LearningCurriculumWizard
                    isOpen={showCurriculumWizard}
                    onClose={() => setShowCurriculumWizard(false)}
                    onComplete={handleCurriculumComplete}
                    userPlan={userPlan}
                />

                {/* Slide Viewer */}
                {slideViewerData && selectedCurriculum && (
                    <SlideViewer
                        curriculumId={selectedCurriculum.id}
                        dayNumber={slideViewerData.day.day}
                        dayTitle={slideViewerData.day.title}
                        dayDescription={slideViewerData.day.description}
                        objectives={slideViewerData.day.objectives}
                        topic={selectedCurriculum.topic}
                        currentLevel={selectedCurriculum.currentLevel}
                        targetLevel={selectedCurriculum.targetLevel}
                        onClose={() => setSlideViewerData(null)}
                        onComplete={handleSlideComplete}
                    />
                )}
            </div>
        </div>
    );
}
