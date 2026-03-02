"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ArrowLeft, Bell, RefreshCw, Save, Check,
    User, Crown, Palette, Shield, Brain
} from "lucide-react";
import { toast } from "sonner";
import { PlanSettings } from "./PlanSettings";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    UserProfile, UserSettings, NotificationSettings, AppearanceSettings, AISettings
} from "./settingsConstants";
import { ProfileTab } from "./ProfileTab";
import { NotificationsTab } from "./NotificationsTab";
import { AppearanceTab } from "./AppearanceTab";
import { AISettingsTab } from "./AISettingsTab";
import { AccountTab } from "./AccountTab";

interface SettingsContentProps {
    username: string;
    email: string;
}

export function SettingsContent({ username, email }: SettingsContentProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const [activeTab, setActiveTab] = useState("profile");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Profile state
    const [profile, setProfile] = useState<UserProfile>({
        job: "",
        goal: "",
        level: "",
        interests: [],
        name: username,
    });

    // Settings states
    const [userSettings, setUserSettings] = useState<UserSettings>({
        wakeUpTime: "07:00",
        sleepTime: "23:00",
        exerciseEnabled: false,
        location: "Seoul,KR",
    });

    const [notifications, setNotifications] = useState<NotificationSettings>({
        dailyReminder: true,
        scheduleAlerts: true,
        trendAlerts: true,
        weeklyReport: true,
        emailNotifications: false,
        soundEnabled: true,
        reminderMinutes: 10,
    });

    const [appearance, setAppearance] = useState<AppearanceSettings>({
        theme: "system",
        fontSize: "medium",
        language: "ko",
        compactMode: false,
        animationsEnabled: true,
    });

    const [aiSettings, setAISettings] = useState<AISettings>({
        responseStyle: "balanced",
        learningDifficulty: "moderate",
        autoSuggestions: true,
        proactiveInsights: true,
    });

    const isGoogleConnected = session?.user?.email?.includes('@gmail.com') || false;

    // Load settings from localStorage, then sync from server
    useEffect(() => {
        // 1. 즉시 localStorage에서 로드 (빠른 초기 렌더)
        const savedProfile = localStorage.getItem("user_profile");
        if (savedProfile) setProfile(JSON.parse(savedProfile));

        const savedNotifications = localStorage.getItem("user_notifications");
        if (savedNotifications) setNotifications(JSON.parse(savedNotifications));

        const savedSettings = localStorage.getItem("user_settings");
        if (savedSettings) setUserSettings(JSON.parse(savedSettings));

        const savedAppearance = localStorage.getItem("user_appearance");
        if (savedAppearance) setAppearance(JSON.parse(savedAppearance));

        const savedAI = localStorage.getItem("user_ai_settings");
        if (savedAI) setAISettings(JSON.parse(savedAI));

        // 2. 서버에서 최신 프로필 가져와 병합
        (async () => {
            try {
                const res = await fetch('/api/user/profile');
                if (!res.ok) return;
                const data = await res.json();
                const serverSettings = data.profile?.settings;
                if (!serverSettings) return;

                if (serverSettings.profile) {
                    // 서버 값 중 빈 문자열/undefined는 로컬 값 유지
                    const merged = { ...serverSettings.profile };
                    if (!merged.name) delete merged.name;
                    setProfile(prev => ({ ...prev, ...merged }));
                    localStorage.setItem("user_profile", JSON.stringify({ ...JSON.parse(savedProfile || '{}'), ...merged }));
                }
                if (serverSettings.notifications) {
                    setNotifications(prev => ({ ...prev, ...serverSettings.notifications }));
                    localStorage.setItem("user_notifications", JSON.stringify({ ...JSON.parse(savedNotifications || '{}'), ...serverSettings.notifications }));
                }
                if (serverSettings.userSettings) {
                    setUserSettings(prev => ({ ...prev, ...serverSettings.userSettings }));
                    localStorage.setItem("user_settings", JSON.stringify({ ...JSON.parse(savedSettings || '{}'), ...serverSettings.userSettings }));
                }
                if (serverSettings.appearance) {
                    setAppearance(prev => ({ ...prev, ...serverSettings.appearance }));
                    localStorage.setItem("user_appearance", JSON.stringify({ ...JSON.parse(savedAppearance || '{}'), ...serverSettings.appearance }));
                }
                if (serverSettings.aiSettings) {
                    setAISettings(prev => ({ ...prev, ...serverSettings.aiSettings }));
                    localStorage.setItem("user_ai_settings", JSON.stringify({ ...JSON.parse(savedAI || '{}'), ...serverSettings.aiSettings }));
                }
            } catch {
                // 서버 동기화 실패 시 localStorage 값 유지
            }
        })();
    }, []);

    const handleSave = useCallback(async () => {
        setSaving(true);
        // localStorage 캐시 저장 (오프라인 대비)
        localStorage.setItem("user_profile", JSON.stringify(profile));
        localStorage.setItem("user_notifications", JSON.stringify(notifications));
        localStorage.setItem("user_settings", JSON.stringify(userSettings));
        localStorage.setItem("user_appearance", JSON.stringify(appearance));
        localStorage.setItem("user_ai_settings", JSON.stringify(aiSettings));

        // 서버 동기화
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        profile,
                        notifications,
                        userSettings,
                        appearance,
                        aiSettings,
                    }
                }),
            });
            if (res.ok) {
                toast.success('설정이 저장되었습니다');
            } else {
                toast.error('서버 저장에 실패했습니다');
            }
        } catch {
            toast.error('서버 저장에 실패했습니다. 로컬에만 저장됩니다.');
        }

        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }, [profile, notifications, userSettings, appearance, aiSettings]);

    const toggleInterest = (interestId: string) => {
        setProfile(prev => ({
            ...prev,
            interests: prev.interests.includes(interestId)
                ? prev.interests.filter(i => i !== interestId)
                : [...prev.interests, interestId]
        }));
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">설정</h1>
                            <p className="text-sm text-muted-foreground">앱 환경을 맞춤 설정하세요</p>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
                        {saving ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : saved ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {saved ? "저장됨" : "저장"}
                    </Button>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    {/* Tab Navigation */}
                    <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
                        <TabsTrigger value="profile" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-background rounded-lg">
                            <User className="w-4 h-4" />
                            <span className="hidden sm:inline">프로필</span>
                        </TabsTrigger>
                        <TabsTrigger value="plan" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-background rounded-lg">
                            <Crown className="w-4 h-4" />
                            <span className="hidden sm:inline">플랜</span>
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-background rounded-lg">
                            <Bell className="w-4 h-4" />
                            <span className="hidden sm:inline">알림</span>
                        </TabsTrigger>
                        <TabsTrigger value="appearance" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-background rounded-lg">
                            <Palette className="w-4 h-4" />
                            <span className="hidden sm:inline">외관</span>
                        </TabsTrigger>
                        <TabsTrigger value="ai" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-background rounded-lg">
                            <Brain className="w-4 h-4" />
                            <span className="hidden sm:inline">AI</span>
                        </TabsTrigger>
                        <TabsTrigger value="account" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-background rounded-lg">
                            <Shield className="w-4 h-4" />
                            <span className="hidden sm:inline">계정</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Profile Tab */}
                    <TabsContent value="profile" className="space-y-6">
                        <ProfileTab
                            profile={profile}
                            setProfile={setProfile}
                            userSettings={userSettings}
                            setUserSettings={setUserSettings}
                            toggleInterest={toggleInterest}
                        />
                    </TabsContent>

                    {/* Plan Tab */}
                    <TabsContent value="plan" className="space-y-6">
                        <PlanSettings />
                    </TabsContent>

                    {/* Notifications Tab */}
                    <TabsContent value="notifications" className="space-y-6">
                        <NotificationsTab
                            notifications={notifications}
                            setNotifications={setNotifications}
                        />
                    </TabsContent>

                    {/* Appearance Tab */}
                    <TabsContent value="appearance" className="space-y-6">
                        <AppearanceTab
                            appearance={appearance}
                            setAppearance={setAppearance}
                        />
                    </TabsContent>

                    {/* AI Tab */}
                    <TabsContent value="ai" className="space-y-6">
                        <AISettingsTab
                            aiSettings={aiSettings}
                            setAISettings={setAISettings}
                        />
                    </TabsContent>

                    {/* Account Tab */}
                    <TabsContent value="account" className="space-y-6">
                        <AccountTab
                            email={email}
                            username={username}
                            session={session}
                            isGoogleConnected={isGoogleConnected}
                            router={router}
                            profile={profile}
                            userSettings={userSettings}
                            notifications={notifications}
                            appearance={appearance}
                            aiSettings={aiSettings}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
