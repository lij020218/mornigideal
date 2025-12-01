"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Bell, Trash2, Save, RefreshCw, Sun, Dumbbell, Target, Mail, Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

interface SettingsContentProps {
    username: string;
    email: string;
}

interface UserProfile {
    job: string;
    goal: string;
    level: string;
}

interface UserSettings {
    wakeUpTime: string;
    exerciseEnabled: boolean;
}

const goalOptions = [
    { id: "expert", label: "업계 최고의 전문가 되기" },
    { id: "promotion", label: "빠른 승진 및 연봉 인상" },
    { id: "switch", label: "성공적인 직무 전환" },
];

export function SettingsContent({ username, email }: SettingsContentProps) {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [profile, setProfile] = useState<UserProfile>({
        job: "",
        goal: "",
        level: "",
    });
    const [notifications, setNotifications] = useState({
        dailyReminder: true,
        trendAlerts: true,
        weeklyReport: false,
    });
    const [userSettings, setUserSettings] = useState<UserSettings>({
        wakeUpTime: "07:00",
        exerciseEnabled: false,
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [gmailLinking, setGmailLinking] = useState(false);
    const [gmailLinked, setGmailLinked] = useState<string | null>(null);

    // Check if Google account is connected (for Google login users)
    const isGoogleConnected = session?.user?.email?.includes('@gmail.com') || false;

    // Check if Gmail is linked (for non-Google login users)
    useEffect(() => {
        const checkGmailLinked = async () => {
            try {
                const response = await fetch('/api/auth/check-gmail-link');
                if (response.ok) {
                    const data = await response.json();
                    if (data.linked) {
                        setGmailLinked(data.gmailEmail);
                    }
                }
            } catch (error) {
                console.error('Failed to check Gmail link:', error);
            }
        };

        if (!isGoogleConnected && session?.user?.email) {
            checkGmailLinked();
        }
    }, [session, isGoogleConnected]);

    // Handle Gmail linking popup
    const handleLinkGmail = async () => {
        if (!session?.user?.email) {
            alert('로그인이 필요합니다');
            return;
        }

        setGmailLinking(true);

        try {
            // Get OAuth URL
            const response = await fetch('/api/auth/link-gmail');
            const { authUrl } = await response.json();

            // Open popup
            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                authUrl,
                'Gmail 연동',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            // Safety timeout reference (will be set after handleMessage is defined)
            let safetyTimeout: NodeJS.Timeout;

            // Listen for messages from popup
            const handleMessage = (event: MessageEvent) => {
                if (event.data.type === 'gmail-link-success') {
                    clearTimeout(safetyTimeout);
                    setGmailLinked(event.data.data.gmailEmail);
                    setGmailLinking(false);
                    alert('Gmail 계정이 성공적으로 연동되었습니다!');
                    window.removeEventListener('message', handleMessage);
                } else if (event.data.type === 'gmail-link-error') {
                    clearTimeout(safetyTimeout);
                    setGmailLinking(false);
                    alert('Gmail 연동에 실패했습니다: ' + event.data.error);
                    window.removeEventListener('message', handleMessage);
                }
            };

            window.addEventListener('message', handleMessage);

            // Safety timeout - reset loading state after 2 minutes if no response
            // This ensures the UI doesn't get stuck in loading state
            safetyTimeout = setTimeout(() => {
                setGmailLinking(false);
                window.removeEventListener('message', handleMessage);
                console.log('[Gmail Link] Timeout - popup did not respond');
            }, 120000); // 2 minutes
        } catch (error) {
            console.error('Link Gmail error:', error);
            alert('Gmail 연동 중 오류가 발생했습니다');
            setGmailLinking(false);
        }
    };

    useEffect(() => {
        const savedProfile = localStorage.getItem("user_profile");
        if (savedProfile) {
            setProfile(JSON.parse(savedProfile));
        }

        const savedNotifications = localStorage.getItem("user_notifications");
        if (savedNotifications) {
            setNotifications(JSON.parse(savedNotifications));
        }

        const savedSettings = localStorage.getItem("user_settings");
        if (savedSettings) {
            setUserSettings(JSON.parse(savedSettings));
        }
    }, []);

    const handleSave = () => {
        setSaving(true);
        localStorage.setItem("user_profile", JSON.stringify(profile));
        localStorage.setItem("user_notifications", JSON.stringify(notifications));
        localStorage.setItem("user_settings", JSON.stringify(userSettings));

        setTimeout(() => {
            setSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 500);
    };

    const handleResetOnboarding = () => {
        if (confirm("온보딩을 다시 시작하시겠습니까? 기존 데이터는 삭제됩니다.")) {
            localStorage.removeItem("user_profile");
            localStorage.removeItem("user_curriculum");
            // Clear peer insights cache
            Object.keys(localStorage).forEach((key) => {
                if (key.startsWith("peer_insight_")) {
                    localStorage.removeItem(key);
                }
            });
            router.push("/onboarding");
        }
    };

    const handleClearCache = () => {
        // Clear all cached data
        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("peer_insight_")) {
                localStorage.removeItem(key);
            }
        });
        alert("캐시가 삭제되었습니다.");
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-8">
            {/* Header */}
            <header className="flex items-center gap-4">
                <Link href="/dashboard">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">설정</h1>
                    <p className="text-muted-foreground">앱 설정을 관리합니다</p>
                </div>
            </header>

            {/* Profile Settings */}
            <Card className="glass-card border-none">
                <CardHeader>
                    <CardTitle className="text-lg">프로필 설정</CardTitle>
                    <CardDescription>직업 정보와 목표를 수정할 수 있습니다</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="job">직업</Label>
                        <Input
                            id="job"
                            value={profile.job}
                            onChange={(e) => setProfile({ ...profile, job: e.target.value })}
                            placeholder="예: 마케터, 개발자, 디자이너"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>목표</Label>
                        <div className="space-y-2">
                            {goalOptions.map((goal) => (
                                <button
                                    key={goal.id}
                                    onClick={() => setProfile({ ...profile, goal: goal.id })}
                                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                                        profile.goal === goal.id
                                            ? "bg-primary/20 border border-primary"
                                            : "bg-white/5 border border-transparent hover:bg-white/10"
                                    }`}
                                >
                                    {goal.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>레벨</Label>
                        <div className="flex gap-2">
                            {[
                                { id: "junior", label: "주니어" },
                                { id: "mid", label: "미드레벨" },
                                { id: "senior", label: "시니어" },
                            ].map((level) => (
                                <button
                                    key={level.id}
                                    onClick={() => setProfile({ ...profile, level: level.id })}
                                    className={`flex-1 p-3 rounded-lg text-center transition-colors ${
                                        profile.level === level.id
                                            ? "bg-primary/20 border border-primary"
                                            : "bg-white/5 border border-transparent hover:bg-white/10"
                                    }`}
                                >
                                    {level.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card className="glass-card border-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Bell className="w-5 h-5 text-primary" />
                        알림 설정
                    </CardTitle>
                    <CardDescription>알림 수신 여부를 설정합니다</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">일일 학습 리마인더</p>
                            <p className="text-sm text-muted-foreground">매일 아침 학습 알림을 받습니다</p>
                        </div>
                        <Switch
                            checked={notifications.dailyReminder}
                            onCheckedChange={(checked) =>
                                setNotifications({ ...notifications, dailyReminder: checked })
                            }
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">트렌드 알림</p>
                            <p className="text-sm text-muted-foreground">새로운 트렌드 소식을 받습니다</p>
                        </div>
                        <Switch
                            checked={notifications.trendAlerts}
                            onCheckedChange={(checked) =>
                                setNotifications({ ...notifications, trendAlerts: checked })
                            }
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">주간 리포트</p>
                            <p className="text-sm text-muted-foreground">매주 성장 리포트를 받습니다</p>
                        </div>
                        <Switch
                            checked={notifications.weeklyReport}
                            onCheckedChange={(checked) =>
                                setNotifications({ ...notifications, weeklyReport: checked })
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Google Account Connection */}
            <Card className="glass-card border-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Mail className="w-5 h-5 text-primary" />
                        구글 계정 연동
                    </CardTitle>
                    <CardDescription>Gmail 이메일 요약 기능을 사용하려면 구글 계정을 연동하세요</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isGoogleConnected || gmailLinked ? (
                        <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-green-100">Gmail 계정 연동됨</p>
                                    <p className="text-sm text-green-200/70">
                                        {gmailLinked || session?.user?.email}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                onClick={() => {
                                    alert("Gmail 연동 해제 기능은 준비 중입니다.");
                                }}
                            >
                                <X className="w-4 h-4 mr-2" />
                                연동 해제
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <p className="text-sm text-blue-200">
                                    구글 계정을 연동하면 Gmail 이메일을 AI가 자동으로 요약해드립니다.
                                </p>
                                <ul className="mt-3 space-y-2 text-sm text-blue-200/80">
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-blue-400" />
                                        읽지 않은 중요 이메일 선별
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-blue-400" />
                                        AI 기반 이메일 요약
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-blue-400" />
                                        업무 효율성 향상
                                    </li>
                                </ul>
                            </div>
                            <Button
                                className="w-full"
                                onClick={handleLinkGmail}
                                disabled={gmailLinking}
                            >
                                {gmailLinking ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        연동 중...
                                    </>
                                ) : (
                                    <>
                                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            />
                                        </svg>
                                        Gmail 계정 연동하기
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Daily Goals Settings */}
            <Card className="glass-card border-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Target className="w-5 h-5 text-primary" />
                        일일 목표 설정
                    </CardTitle>
                    <CardDescription>매일 달성할 목표를 설정합니다</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="wakeUpTime" className="flex items-center gap-2">
                            <Sun className="w-4 h-4 text-yellow-500" />
                            기상 목표 시간
                        </Label>
                        <Input
                            id="wakeUpTime"
                            type="time"
                            value={userSettings.wakeUpTime}
                            onChange={(e) => setUserSettings({ ...userSettings, wakeUpTime: e.target.value })}
                            className="w-32"
                        />
                        <p className="text-sm text-muted-foreground">
                            이 시간 전에 기상 체크를 하면 목표 달성!
                        </p>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 text-green-500" />
                            <div>
                                <p className="font-medium">운동 목표 활성화</p>
                                <p className="text-sm text-muted-foreground">일일 목표에 운동 항목을 추가합니다</p>
                            </div>
                        </div>
                        <Switch
                            checked={userSettings.exerciseEnabled}
                            onCheckedChange={(checked) =>
                                setUserSettings({ ...userSettings, exerciseEnabled: checked })
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Data Management */}
            <Card className="glass-card border-none">
                <CardHeader>
                    <CardTitle className="text-lg">데이터 관리</CardTitle>
                    <CardDescription>캐시 및 온보딩 데이터를 관리합니다</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={handleClearCache}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        캐시 삭제
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full justify-start text-orange-400 hover:text-orange-300"
                        onClick={handleResetOnboarding}
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        온보딩 다시 시작
                    </Button>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end gap-4">
                <Link href="/dashboard">
                    <Button variant="outline">취소</Button>
                </Link>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                        <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            저장 중...
                        </>
                    ) : saved ? (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            저장됨!
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            저장하기
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
