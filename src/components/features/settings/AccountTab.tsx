"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Trash2, RefreshCw, Check, X,
    User, AlertTriangle, Eye, EyeOff,
    Download, Info, Shield,
    Mail, Database, Hash, CalendarDays, FileText
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { UserProfile, UserSettings, NotificationSettings, AppearanceSettings, AISettings } from "./settingsConstants";

interface AccountTabProps {
    email: string;
    username: string;
    session: Session | null;
    isGoogleConnected: boolean;
    router: ReturnType<typeof useRouter>;
    profile: UserProfile;
    userSettings: UserSettings;
    notifications: NotificationSettings;
    appearance: AppearanceSettings;
    aiSettings: AISettings;
}

export function AccountTab({ email, username, session, isGoogleConnected, router, profile, userSettings, notifications, appearance, aiSettings }: AccountTabProps) {
    // Gmail states
    const [gmailLinking, setGmailLinking] = useState(false);
    const [gmailLinked, setGmailLinked] = useState<string | null>(null);

    // Slack states
    const [slackLinking, setSlackLinking] = useState(false);
    const [slackLinked, setSlackLinked] = useState<{ teamName: string; slackUserId: string } | null>(null);

    // Google Calendar states
    const [gcalLinking, setGcalLinking] = useState(false);
    const [gcalLinked, setGcalLinked] = useState(false);

    // Account deletion states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Check Gmail link
    React.useEffect(() => {
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

    // Check Slack link
    React.useEffect(() => {
        const checkSlackLinked = async () => {
            try {
                const response = await fetch('/api/auth/check-slack-link');
                if (response.ok) {
                    const data = await response.json();
                    if (data.linked) {
                        setSlackLinked({ teamName: data.teamName, slackUserId: data.slackUserId });
                    }
                }
            } catch (error) {
                console.error('Failed to check Slack link:', error);
            }
        };

        if (session?.user?.email) {
            checkSlackLinked();
        }
    }, [session]);

    // Check Google Calendar link (localStorage 캐시 기반)
    React.useEffect(() => {
        if (session?.user?.email) {
            const cached = localStorage.getItem('gcal_linked');
            if (cached === 'true') {
                setGcalLinked(true);
            }
        }
    }, [session]);

    const handleLinkGmail = async () => {
        if (!session?.user?.email) {
            toast.error('로그인이 필요합니다');
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
                    toast.error('Gmail 연동에 실패했습니다');
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
            toast.error('Gmail 연동 중 오류가 발생했습니다');
            setGmailLinking(false);
        }
    };

    const handleLinkGcal = async () => {
        if (!session?.user?.email) {
            toast.error('로그인이 필요합니다');
            return;
        }

        setGcalLinking(true);
        try {
            const response = await fetch('/api/auth/link-google-calendar');
            const { authUrl } = await response.json();

            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                authUrl,
                'Google 캘린더 연동',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            let safetyTimeout: NodeJS.Timeout;

            const handleMessage = (event: MessageEvent) => {
                if (event.data.type === 'gcal-link-success') {
                    clearTimeout(safetyTimeout);
                    setGcalLinked(true);
                    localStorage.setItem('gcal_linked', 'true');
                    setGcalLinking(false);
                    window.removeEventListener('message', handleMessage);
                } else if (event.data.type === 'gcal-link-error') {
                    clearTimeout(safetyTimeout);
                    setGcalLinking(false);
                    toast.error('Google 캘린더 연동에 실패했습니다');
                    window.removeEventListener('message', handleMessage);
                }
            };

            window.addEventListener('message', handleMessage);
            safetyTimeout = setTimeout(() => {
                setGcalLinking(false);
                window.removeEventListener('message', handleMessage);
            }, 120000);
        } catch (error) {
            console.error('Link GCal error:', error);
            toast.error('Google 캘린더 연동 중 오류가 발생했습니다');
            setGcalLinking(false);
        }
    };

    const handleLinkSlack = async () => {
        if (!session?.user?.email) {
            toast.error('로그인이 필요합니다');
            return;
        }

        setSlackLinking(true);
        try {
            const response = await fetch('/api/auth/link-slack');
            const { authUrl } = await response.json();

            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                authUrl,
                '슬랙 연동',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            let safetyTimeout: NodeJS.Timeout;

            const handleMessage = (event: MessageEvent) => {
                if (event.data.type === 'slack-link-success') {
                    clearTimeout(safetyTimeout);
                    setSlackLinked({
                        teamName: event.data.data.teamName,
                        slackUserId: event.data.data.slackUserId,
                    });
                    setSlackLinking(false);
                    window.removeEventListener('message', handleMessage);
                } else if (event.data.type === 'slack-link-error') {
                    clearTimeout(safetyTimeout);
                    setSlackLinking(false);
                    toast.error('슬랙 연동에 실패했습니다');
                    window.removeEventListener('message', handleMessage);
                }
            };

            window.addEventListener('message', handleMessage);
            safetyTimeout = setTimeout(() => {
                setSlackLinking(false);
                window.removeEventListener('message', handleMessage);
            }, 120000);
        } catch (error) {
            console.error('Link Slack error:', error);
            toast.error('슬랙 연동 중 오류가 발생했습니다');
            setSlackLinking(false);
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
            toast.error('데이터 내보내기에 실패했습니다');
        }
    };

    const handleDeleteAccount = async () => {
        if (!deletePassword) {
            toast.warning("비밀번호를 입력해주세요.");
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
                toast.error(data.error || "계정 삭제에 실패했습니다.");
            }
        } catch (error) {
            console.error("Account deletion error:", error);
            toast.error("계정 삭제 중 오류가 발생했습니다.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
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

            {/* Google Calendar Connection */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-primary" />
                        Google 캘린더 연동
                    </CardTitle>
                    <CardDescription>캘린더 일정을 자동으로 동기화합니다</CardDescription>
                </CardHeader>
                <CardContent>
                    {gcalLinked ? (
                        <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check className="w-5 h-5 text-green-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-green-700 dark:text-green-300">캘린더 연동됨</p>
                                    <p className="text-sm text-green-600 dark:text-green-400">자동 동기화 활성</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <p className="text-sm mb-3">Google 캘린더 연동 시 사용 가능한 기능:</p>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-blue-500" />
                                        캘린더 일정 자동 가져오기
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-blue-500" />
                                        AI가 추가한 일정 캘린더에 반영
                                    </li>
                                </ul>
                            </div>
                            <Button className="w-full gap-2" onClick={handleLinkGcal} disabled={gcalLinking}>
                                {gcalLinking ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CalendarDays className="w-4 h-4" />
                                )}
                                {gcalLinking ? "연동 중..." : "Google 캘린더 연동하기"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Slack Connection */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Hash className="w-5 h-5 text-primary" />
                        슬랙 연동
                    </CardTitle>
                    <CardDescription>슬랙 미확인 메시지 요약 및 알림 전송</CardDescription>
                </CardHeader>
                <CardContent>
                    {slackLinked ? (
                        <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check className="w-5 h-5 text-green-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-green-700 dark:text-green-300">슬랙 연동됨</p>
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                        {slackLinked.teamName} 워크스페이스
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
                            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                <p className="text-sm mb-3">슬랙 연동 시 사용 가능한 기능:</p>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-purple-500" />
                                        미확인 메시지/DM 아침 요약
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-purple-500" />
                                        Fi.eri 알림을 슬랙으로 전송
                                    </li>
                                </ul>
                            </div>
                            <Button className="w-full gap-2" onClick={handleLinkSlack} disabled={slackLinking}>
                                {slackLinking ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Hash className="w-4 h-4" />
                                )}
                                {slackLinking ? "연동 중..." : "슬랙 연동하기"}
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
                            toast.success("캐시가 삭제되었습니다.");
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
        </>
    );
}
