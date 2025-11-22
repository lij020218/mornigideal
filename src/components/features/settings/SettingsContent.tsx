"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Bell, Trash2, Save, RefreshCw, Sun, Dumbbell, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
