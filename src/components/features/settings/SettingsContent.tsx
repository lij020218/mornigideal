"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft, Bell, Trash2, Save, RefreshCw, Sun, Dumbbell, Target, Mail, Check, X,
    User, AlertTriangle, Eye, EyeOff, MapPin, Crown, Settings, Palette, Shield,
    Download, Upload, Keyboard, Info, Moon, Monitor, Languages, Brain, Sparkles,
    Volume2, Clock, Calendar, FileText, Database, HelpCircle, ExternalLink,
    ChevronRight, Zap, BookOpen, MessageSquare, Globe, Lock, Key, Smartphone,
    History, BarChart3, Mic, Type, Lightbulb
} from "lucide-react";
import { PlanSettings } from "./PlanSettings";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface SettingsContentProps {
    username: string;
    email: string;
}

interface UserProfile {
    job: string;
    goal: string;
    level: string;
    interests: string[];
    name: string;
}

interface UserSettings {
    wakeUpTime: string;
    sleepTime: string;
    exerciseEnabled: boolean;
    location: string;
}

interface NotificationSettings {
    dailyReminder: boolean;
    scheduleAlerts: boolean;
    trendAlerts: boolean;
    weeklyReport: boolean;
    emailNotifications: boolean;
    soundEnabled: boolean;
    reminderMinutes: number;
}

interface AppearanceSettings {
    theme: "system" | "light" | "dark";
    fontSize: "small" | "medium" | "large";
    language: "ko" | "en";
    compactMode: boolean;
    animationsEnabled: boolean;
}

interface AISettings {
    responseStyle: "concise" | "detailed" | "balanced";
    learningDifficulty: "easy" | "moderate" | "challenging";
    autoSuggestions: boolean;
    proactiveInsights: boolean;
}

const locationOptions = [
    { id: 'Seoul,KR', label: '서울' },
    { id: 'Busan,KR', label: '부산' },
    { id: 'Incheon,KR', label: '인천' },
    { id: 'Daegu,KR', label: '대구' },
    { id: 'Daejeon,KR', label: '대전' },
    { id: 'Gwangju,KR', label: '광주' },
    { id: 'Ulsan,KR', label: '울산' },
    { id: 'Sejong,KR', label: '세종' },
    { id: 'Suwon,KR', label: '수원' },
    { id: 'Yongin,KR', label: '용인' },
    { id: 'Goyang,KR', label: '고양' },
    { id: 'Seongnam,KR', label: '성남' },
    { id: 'Jeonju,KR', label: '전주' },
    { id: 'Cheongju,KR', label: '청주' },
    { id: 'Changwon,KR', label: '창원' },
    { id: 'Jeju,KR', label: '제주' },
];

const goalOptions = [
    { id: "expert", label: "업계 최고의 전문가 되기", icon: Crown },
    { id: "promotion", label: "빠른 승진 및 연봉 인상", icon: Zap },
    { id: "switch", label: "성공적인 직무 전환", icon: RefreshCw },
    { id: "balance", label: "워라밸 개선", icon: Target },
];

const interestOptions = [
    { id: "tech", label: "기술/IT" },
    { id: "business", label: "비즈니스" },
    { id: "design", label: "디자인" },
    { id: "marketing", label: "마케팅" },
    { id: "finance", label: "금융/재테크" },
    { id: "health", label: "건강/운동" },
    { id: "language", label: "외국어" },
    { id: "creative", label: "창작/예술" },
];

// Settings Sections Component
const SettingsSection = ({ title, description, icon: Icon, children }: {
    title: string;
    description?: string;
    icon?: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) => (
    <div className="space-y-4">
        <div className="flex items-center gap-3">
            {Icon && (
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                </div>
            )}
            <div>
                <h3 className="font-semibold text-lg">{title}</h3>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
        </div>
        <div className="space-y-4 pl-0 md:pl-13">{children}</div>
    </div>
);

// Settings Row Component
const SettingsRow = ({ label, description, children, badge }: {
    label: string;
    description?: string;
    children: React.ReactNode;
    badge?: string;
}) => (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
        <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
                <span className="font-medium">{label}</span>
                {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
            </div>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <div className="flex-shrink-0">{children}</div>
    </div>
);

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

    // Gmail states
    const [gmailLinking, setGmailLinking] = useState(false);
    const [gmailLinked, setGmailLinked] = useState<string | null>(null);

    // Account deletion states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isGoogleConnected = session?.user?.email?.includes('@gmail.com') || false;

    // Load settings from localStorage
    useEffect(() => {
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
    }, []);

    // Check Gmail link
    useEffect(() => {
        const checkGmailLinked = async () => {
            try {
                const response = await fetch('/api/auth/check-gmail-link');
                if (response.ok) {
                    const data = await response.json();
                    if (data.linked) setGmailLinked(data.gmailEmail);
                }
            } catch (error) {
                console.error('Failed to check Gmail link:', error);
            }
        };

        if (!isGoogleConnected && session?.user?.email) {
            checkGmailLinked();
        }
    }, [session, isGoogleConnected]);

    const handleSave = useCallback(() => {
        setSaving(true);
        localStorage.setItem("user_profile", JSON.stringify(profile));
        localStorage.setItem("user_notifications", JSON.stringify(notifications));
        localStorage.setItem("user_settings", JSON.stringify(userSettings));
        localStorage.setItem("user_appearance", JSON.stringify(appearance));
        localStorage.setItem("user_ai_settings", JSON.stringify(aiSettings));

        setTimeout(() => {
            setSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 500);
    }, [profile, notifications, userSettings, appearance, aiSettings]);

    const handleLinkGmail = async () => {
        if (!session?.user?.email) {
            alert('로그인이 필요합니다');
            return;
        }

        setGmailLinking(true);
        try {
            const response = await fetch('/api/auth/link-gmail');
            const { authUrl } = await response.json();

            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                authUrl,
                'Gmail 연동',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            let safetyTimeout: NodeJS.Timeout;

            const handleMessage = (event: MessageEvent) => {
                if (event.data.type === 'gmail-link-success') {
                    clearTimeout(safetyTimeout);
                    setGmailLinked(event.data.data.gmailEmail);
                    setGmailLinking(false);
                    window.removeEventListener('message', handleMessage);
                } else if (event.data.type === 'gmail-link-error') {
                    clearTimeout(safetyTimeout);
                    setGmailLinking(false);
                    alert('Gmail 연동에 실패했습니다: ' + event.data.error);
                    window.removeEventListener('message', handleMessage);
                }
            };

            window.addEventListener('message', handleMessage);
            safetyTimeout = setTimeout(() => {
                setGmailLinking(false);
                window.removeEventListener('message', handleMessage);
            }, 120000);
        } catch (error) {
            console.error('Link Gmail error:', error);
            alert('Gmail 연동 중 오류가 발생했습니다');
            setGmailLinking(false);
        }
    };

    const handleExportData = async () => {
        try {
            const exportData = {
                profile,
                settings: userSettings,
                notifications,
                appearance,
                aiSettings,
                exportedAt: new Date().toISOString(),
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fieri-settings-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert('데이터 내보내기에 실패했습니다');
        }
    };

    const handleDeleteAccount = async () => {
        if (!deletePassword) {
            alert("비밀번호를 입력해주세요.");
            return;
        }

        setDeleting(true);
        try {
            const response = await fetch("/api/user/account", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: deletePassword }),
            });

            if (response.ok) {
                localStorage.clear();
                await signOut({ callbackUrl: "/landing" });
            } else {
                const data = await response.json();
                alert(data.error || "계정 삭제에 실패했습니다.");
            }
        } catch (error) {
            console.error("Account deletion error:", error);
            alert("계정 삭제 중 오류가 발생했습니다.");
        } finally {
            setDeleting(false);
        }
    };

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
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="w-5 h-5 text-primary" />
                                    기본 정보
                                </CardTitle>
                                <CardDescription>프로필 정보를 수정하세요</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">이름</Label>
                                        <Input
                                            id="name"
                                            value={profile.name}
                                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                            placeholder="이름을 입력하세요"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="job">직업</Label>
                                        <Input
                                            id="job"
                                            value={profile.job}
                                            onChange={(e) => setProfile({ ...profile, job: e.target.value })}
                                            placeholder="예: 마케터, 개발자"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label>경력 레벨</Label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: "junior", label: "주니어", desc: "0-3년" },
                                            { id: "mid", label: "미드레벨", desc: "3-7년" },
                                            { id: "senior", label: "시니어", desc: "7년+" },
                                        ].map((level) => (
                                            <button
                                                key={level.id}
                                                onClick={() => setProfile({ ...profile, level: level.id })}
                                                className={cn(
                                                    "flex-1 p-3 rounded-xl text-center transition-all border",
                                                    profile.level === level.id
                                                        ? "bg-primary/10 border-primary text-primary"
                                                        : "bg-muted/50 border-transparent hover:bg-muted"
                                                )}
                                            >
                                                <div className="font-medium">{level.label}</div>
                                                <div className="text-xs text-muted-foreground">{level.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label>커리어 목표</Label>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {goalOptions.map((goal) => {
                                            const Icon = goal.icon;
                                            return (
                                                <button
                                                    key={goal.id}
                                                    onClick={() => setProfile({ ...profile, goal: goal.id })}
                                                    className={cn(
                                                        "flex items-center gap-3 p-3 rounded-xl transition-all border text-left",
                                                        profile.goal === goal.id
                                                            ? "bg-primary/10 border-primary"
                                                            : "bg-muted/50 border-transparent hover:bg-muted"
                                                    )}
                                                >
                                                    <Icon className={cn("w-5 h-5", profile.goal === goal.id ? "text-primary" : "text-muted-foreground")} />
                                                    <span className="text-sm font-medium">{goal.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label>관심 분야 (복수 선택)</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {interestOptions.map((interest) => (
                                            <button
                                                key={interest.id}
                                                onClick={() => toggleInterest(interest.id)}
                                                className={cn(
                                                    "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                                                    profile.interests.includes(interest.id)
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-muted/50 border-transparent hover:bg-muted"
                                                )}
                                            >
                                                {interest.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Daily Goals */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="w-5 h-5 text-primary" />
                                    일일 목표 설정
                                </CardTitle>
                                <CardDescription>매일의 루틴을 설정하세요</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <Sun className="w-4 h-4 text-yellow-500" />
                                            기상 목표 시간
                                        </Label>
                                        <Input
                                            type="time"
                                            value={userSettings.wakeUpTime}
                                            onChange={(e) => setUserSettings({ ...userSettings, wakeUpTime: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <Moon className="w-4 h-4 text-indigo-400" />
                                            취침 목표 시간
                                        </Label>
                                        <Input
                                            type="time"
                                            value={userSettings.sleepTime}
                                            onChange={(e) => setUserSettings({ ...userSettings, sleepTime: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <SettingsRow
                                    label="운동 목표 활성화"
                                    description="일일 목표에 운동 항목을 추가합니다"
                                >
                                    <Switch
                                        checked={userSettings.exerciseEnabled}
                                        onCheckedChange={(checked) => setUserSettings({ ...userSettings, exerciseEnabled: checked })}
                                    />
                                </SettingsRow>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-blue-500" />
                                        날씨 지역
                                    </Label>
                                    <select
                                        value={userSettings.location}
                                        onChange={(e) => setUserSettings({ ...userSettings, location: e.target.value })}
                                        className="w-full p-3 rounded-xl bg-muted/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        {locationOptions.map((loc) => (
                                            <option key={loc.id} value={loc.id}>{loc.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Plan Tab */}
                    <TabsContent value="plan" className="space-y-6">
                        <PlanSettings />
                    </TabsContent>

                    {/* Notifications Tab */}
                    <TabsContent value="notifications" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-primary" />
                                    알림 설정
                                </CardTitle>
                                <CardDescription>알림 수신 방법을 설정하세요</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-1">
                                <SettingsRow
                                    label="일일 학습 리마인더"
                                    description="매일 아침 학습 알림을 받습니다"
                                >
                                    <Switch
                                        checked={notifications.dailyReminder}
                                        onCheckedChange={(checked) => setNotifications({ ...notifications, dailyReminder: checked })}
                                    />
                                </SettingsRow>

                                <SettingsRow
                                    label="일정 알림"
                                    description="예정된 일정 시작 전 알림을 받습니다"
                                >
                                    <Switch
                                        checked={notifications.scheduleAlerts}
                                        onCheckedChange={(checked) => setNotifications({ ...notifications, scheduleAlerts: checked })}
                                    />
                                </SettingsRow>

                                <SettingsRow
                                    label="트렌드 알림"
                                    description="관심 분야의 새로운 트렌드 소식"
                                >
                                    <Switch
                                        checked={notifications.trendAlerts}
                                        onCheckedChange={(checked) => setNotifications({ ...notifications, trendAlerts: checked })}
                                    />
                                </SettingsRow>

                                <SettingsRow
                                    label="주간 리포트"
                                    description="매주 성장 리포트를 받습니다"
                                >
                                    <Switch
                                        checked={notifications.weeklyReport}
                                        onCheckedChange={(checked) => setNotifications({ ...notifications, weeklyReport: checked })}
                                    />
                                </SettingsRow>

                                <SettingsRow
                                    label="이메일 알림"
                                    description="중요한 알림을 이메일로도 받습니다"
                                    badge="Pro"
                                >
                                    <Switch
                                        checked={notifications.emailNotifications}
                                        onCheckedChange={(checked) => setNotifications({ ...notifications, emailNotifications: checked })}
                                    />
                                </SettingsRow>

                                <SettingsRow
                                    label="알림 소리"
                                    description="알림 시 소리를 재생합니다"
                                >
                                    <Switch
                                        checked={notifications.soundEnabled}
                                        onCheckedChange={(checked) => setNotifications({ ...notifications, soundEnabled: checked })}
                                    />
                                </SettingsRow>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-primary" />
                                    알림 타이밍
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <Label>일정 시작 전 알림 (분)</Label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            value={notifications.reminderMinutes}
                                            onChange={(e) => setNotifications({ ...notifications, reminderMinutes: parseInt(e.target.value) })}
                                            max={60}
                                            min={5}
                                            step={5}
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <span className="w-16 text-center font-medium">{notifications.reminderMinutes}분</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Appearance Tab */}
                    <TabsContent value="appearance" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Palette className="w-5 h-5 text-primary" />
                                    테마 및 디스플레이
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label>테마</Label>
                                        <Badge variant="secondary" className="text-xs">준비 중</Badge>
                                    </div>
                                    <div className="flex gap-2">
                                        {[
                                            { id: "system", label: "시스템", icon: Monitor, disabled: true },
                                            { id: "light", label: "라이트", icon: Sun, disabled: false },
                                            { id: "dark", label: "다크", icon: Moon, disabled: true },
                                        ].map((theme) => {
                                            const Icon = theme.icon;
                                            return (
                                                <button
                                                    key={theme.id}
                                                    onClick={() => !theme.disabled && setAppearance({ ...appearance, theme: theme.id as AppearanceSettings["theme"] })}
                                                    disabled={theme.disabled}
                                                    className={cn(
                                                        "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl transition-all border",
                                                        appearance.theme === theme.id
                                                            ? "bg-primary/10 border-primary"
                                                            : theme.disabled
                                                                ? "bg-muted/30 border-transparent opacity-50 cursor-not-allowed"
                                                                : "bg-muted/50 border-transparent hover:bg-muted"
                                                    )}
                                                >
                                                    <Icon className={cn("w-6 h-6", appearance.theme === theme.id ? "text-primary" : "text-muted-foreground")} />
                                                    <span className="text-sm font-medium">{theme.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-muted-foreground">다크 모드는 현재 개발 중입니다.</p>
                                </div>

                                <div className="space-y-3">
                                    <Label>글자 크기</Label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: "small", label: "작게", size: "text-sm" },
                                            { id: "medium", label: "보통", size: "text-base" },
                                            { id: "large", label: "크게", size: "text-lg" },
                                        ].map((font) => (
                                            <button
                                                key={font.id}
                                                onClick={() => setAppearance({ ...appearance, fontSize: font.id as AppearanceSettings["fontSize"] })}
                                                className={cn(
                                                    "flex-1 p-3 rounded-xl transition-all border",
                                                    appearance.fontSize === font.id
                                                        ? "bg-primary/10 border-primary"
                                                        : "bg-muted/50 border-transparent hover:bg-muted"
                                                )}
                                            >
                                                <span className={cn("font-medium", font.size)}>{font.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <SettingsRow
                                    label="컴팩트 모드"
                                    description="UI 요소 간격을 줄여 더 많은 정보를 표시합니다"
                                >
                                    <Switch
                                        checked={appearance.compactMode}
                                        onCheckedChange={(checked) => setAppearance({ ...appearance, compactMode: checked })}
                                    />
                                </SettingsRow>

                                <SettingsRow
                                    label="애니메이션 효과"
                                    description="부드러운 전환 효과를 사용합니다"
                                >
                                    <Switch
                                        checked={appearance.animationsEnabled}
                                        onCheckedChange={(checked) => setAppearance({ ...appearance, animationsEnabled: checked })}
                                    />
                                </SettingsRow>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Languages className="w-5 h-5 text-primary" />
                                    언어
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2">
                                    {[
                                        { id: "ko", label: "한국어", flag: "🇰🇷" },
                                        { id: "en", label: "English", flag: "🇺🇸" },
                                    ].map((lang) => (
                                        <button
                                            key={lang.id}
                                            onClick={() => setAppearance({ ...appearance, language: lang.id as AppearanceSettings["language"] })}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl transition-all border",
                                                appearance.language === lang.id
                                                    ? "bg-primary/10 border-primary"
                                                    : "bg-muted/50 border-transparent hover:bg-muted"
                                            )}
                                        >
                                            <span>{lang.flag}</span>
                                            <span className="font-medium">{lang.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* AI Tab */}
                    <TabsContent value="ai" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-primary" />
                                    AI 어시스턴트 설정
                                </CardTitle>
                                <CardDescription>AI의 응답 스타일과 기능을 조정하세요</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-3">
                                    <Label>응답 스타일</Label>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {[
                                            { id: "concise", label: "간결하게", desc: "핵심만 빠르게", icon: Zap },
                                            { id: "balanced", label: "균형 있게", desc: "적절한 설명", icon: Target },
                                            { id: "detailed", label: "상세하게", desc: "깊이 있는 답변", icon: BookOpen },
                                        ].map((style) => {
                                            const Icon = style.icon;
                                            return (
                                                <button
                                                    key={style.id}
                                                    onClick={() => setAISettings({ ...aiSettings, responseStyle: style.id as AISettings["responseStyle"] })}
                                                    className={cn(
                                                        "flex flex-col items-center gap-2 p-4 rounded-xl transition-all border",
                                                        aiSettings.responseStyle === style.id
                                                            ? "bg-primary/10 border-primary"
                                                            : "bg-muted/50 border-transparent hover:bg-muted"
                                                    )}
                                                >
                                                    <Icon className={cn("w-6 h-6", aiSettings.responseStyle === style.id ? "text-primary" : "text-muted-foreground")} />
                                                    <div className="text-center">
                                                        <div className="font-medium">{style.label}</div>
                                                        <div className="text-xs text-muted-foreground">{style.desc}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label>학습 난이도</Label>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {[
                                            { id: "easy", label: "쉽게", desc: "기초부터 차근차근" },
                                            { id: "moderate", label: "적당히", desc: "균형 잡힌 난이도" },
                                            { id: "challenging", label: "도전적으로", desc: "한 단계 높은 수준" },
                                        ].map((level) => (
                                            <button
                                                key={level.id}
                                                onClick={() => setAISettings({ ...aiSettings, learningDifficulty: level.id as AISettings["learningDifficulty"] })}
                                                className={cn(
                                                    "flex flex-col items-center gap-1 p-4 rounded-xl transition-all border",
                                                    aiSettings.learningDifficulty === level.id
                                                        ? "bg-primary/10 border-primary"
                                                        : "bg-muted/50 border-transparent hover:bg-muted"
                                                )}
                                            >
                                                <div className="font-medium">{level.label}</div>
                                                <div className="text-xs text-muted-foreground">{level.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <SettingsRow
                                    label="자동 제안"
                                    description="AI가 맥락에 맞는 제안을 자동으로 표시합니다"
                                >
                                    <Switch
                                        checked={aiSettings.autoSuggestions}
                                        onCheckedChange={(checked) => setAISettings({ ...aiSettings, autoSuggestions: checked })}
                                    />
                                </SettingsRow>

                                <SettingsRow
                                    label="선제적 인사이트"
                                    description="AI가 중요한 정보를 미리 알려드립니다"
                                    badge="Max"
                                >
                                    <Switch
                                        checked={aiSettings.proactiveInsights}
                                        onCheckedChange={(checked) => setAISettings({ ...aiSettings, proactiveInsights: checked })}
                                    />
                                </SettingsRow>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Account Tab */}
                    <TabsContent value="account" className="space-y-6">
                        {/* Account Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="w-5 h-5 text-primary" />
                                    계정 정보
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                                        <User className="w-8 h-8 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-lg">{username}</h3>
                                        <p className="text-sm text-muted-foreground">{email}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Gmail Connection */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Mail className="w-5 h-5 text-primary" />
                                    구글 계정 연동
                                </CardTitle>
                                <CardDescription>Gmail 이메일 요약 기능을 사용하세요</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isGoogleConnected || gmailLinked ? (
                                    <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                                <Check className="w-5 h-5 text-green-500" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-green-700 dark:text-green-300">Gmail 연동됨</p>
                                                <p className="text-sm text-green-600 dark:text-green-400">
                                                    {gmailLinked || session?.user?.email}
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm" className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                                            <X className="w-4 h-4 mr-2" />
                                            해제
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                            <p className="text-sm mb-3">구글 계정 연동 시 사용 가능한 기능:</p>
                                            <ul className="space-y-2 text-sm">
                                                <li className="flex items-center gap-2">
                                                    <Check className="w-4 h-4 text-blue-500" />
                                                    읽지 않은 중요 이메일 선별
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check className="w-4 h-4 text-blue-500" />
                                                    AI 기반 이메일 요약
                                                </li>
                                            </ul>
                                        </div>
                                        <Button className="w-full gap-2" onClick={handleLinkGmail} disabled={gmailLinking}>
                                            {gmailLinking ? (
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Mail className="w-4 h-4" />
                                            )}
                                            {gmailLinking ? "연동 중..." : "Gmail 연동하기"}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Data Management */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Database className="w-5 h-5 text-primary" />
                                    데이터 관리
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExportData}>
                                    <Download className="w-4 h-4" />
                                    설정 내보내기
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start gap-2"
                                    onClick={() => {
                                        Object.keys(localStorage).forEach((key) => {
                                            if (key.startsWith("peer_insight_")) localStorage.removeItem(key);
                                        });
                                        alert("캐시가 삭제되었습니다.");
                                    }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    캐시 삭제
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start gap-2 text-orange-500"
                                    onClick={() => {
                                        if (confirm("온보딩을 다시 시작하시겠습니까?")) {
                                            localStorage.removeItem("user_profile");
                                            localStorage.removeItem("user_curriculum");
                                            router.push("/onboarding");
                                        }
                                    }}
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    온보딩 다시 시작
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Danger Zone */}
                        <Card className="border-red-500/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-red-500">
                                    <AlertTriangle className="w-5 h-5" />
                                    위험 구역
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!showDeleteConfirm ? (
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
                                        onClick={() => setShowDeleteConfirm(true)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        계정 삭제
                                    </Button>
                                ) : (
                                    <div className="space-y-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                            <div>
                                                <p className="font-medium text-red-500">계정 삭제 확인</p>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    모든 데이터가 영구적으로 삭제됩니다.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-red-500">비밀번호 확인</Label>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    value={deletePassword}
                                                    onChange={(e) => setDeletePassword(e.target.value)}
                                                    placeholder="비밀번호를 입력하세요"
                                                    className="pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => {
                                                    setShowDeleteConfirm(false);
                                                    setDeletePassword("");
                                                }}
                                            >
                                                취소
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                className="flex-1"
                                                onClick={handleDeleteAccount}
                                                disabled={!deletePassword || deleting}
                                            >
                                                {deleting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                                                {deleting ? "삭제 중..." : "삭제"}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* App Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Info className="w-5 h-5 text-primary" />
                                    앱 정보
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex justify-between py-2">
                                    <span className="text-muted-foreground">버전</span>
                                    <span className="font-medium">2.0.0</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-muted-foreground">빌드</span>
                                    <span className="font-medium">2025.01.19</span>
                                </div>
                                <div className="pt-4 flex gap-2">
                                    <Button variant="outline" size="sm" className="flex-1 gap-2" asChild>
                                        <Link href="/terms">
                                            <FileText className="w-4 h-4" />
                                            이용약관
                                        </Link>
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1 gap-2" asChild>
                                        <Link href="/privacy">
                                            <Shield className="w-4 h-4" />
                                            개인정보처리방침
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
