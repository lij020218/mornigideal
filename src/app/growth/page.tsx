"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, BookOpen, LineChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { RecentMaterialsList } from "@/components/features/dashboard/RecentMaterialsList";
import { SmartInsightsWidget } from "@/components/features/dashboard/SmartInsightsWidget";

export default function GrowthPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [habitInsights, setHabitInsights] = useState<any>(null);

    // Redirect if not authenticated
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    // Fetch insights
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
            } catch (error) {
                console.error('[Growth] Failed to fetch data:', error);
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
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">성장</h1>
                    <p className="text-muted-foreground">
                        학습 자료와 성장 분석을 확인하세요
                    </p>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="learning" className="space-y-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="learning" className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            학습
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="flex items-center gap-2">
                            <LineChart className="w-4 h-4" />
                            분석
                        </TabsTrigger>
                    </TabsList>

                    {/* Learning Tab */}
                    <TabsContent value="learning" className="space-y-6">
                        <Card>
                            <CardContent className="p-6">
                                <h2 className="text-xl font-bold mb-4">최근 학습 자료</h2>
                                <RecentMaterialsList />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Analytics Tab */}
                    <TabsContent value="analytics" className="space-y-6">
                        <SmartInsightsWidget habitInsights={habitInsights} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
