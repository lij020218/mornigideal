"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Trash2, RefreshCw, Check, X,
    User, AlertTriangle, Eye, EyeOff,
    Download, Info, Shield, Lock,
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
    // Password change states
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    // Account deletion states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            toast.warning("모든 필드를 입력해주세요.");
            return;
        }
        if (newPassword.length < 8) {
            toast.warning("새 비밀번호는 8자 이상이어야 합니다.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.warning("새 비밀번호가 일치하지 않습니다.");
            return;
        }

        setChangingPassword(true);
        try {
            const response = await fetch("/api/user/account", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await response.json();

            if (response.ok) {
                toast.success("비밀번호가 변경되었습니다.");
                setShowPasswordChange(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                toast.error(data.error || "비밀번호 변경에 실패했습니다.");
            }
        } catch (error) {
            toast.error("비밀번호 변경 중 오류가 발생했습니다.");
        } finally {
            setChangingPassword(false);
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

            {/* Password Change */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-primary" />
                        비밀번호 변경
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!showPasswordChange ? (
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => setShowPasswordChange(true)}
                        >
                            <Lock className="w-4 h-4" />
                            비밀번호 변경하기
                        </Button>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>현재 비밀번호</Label>
                                <div className="relative">
                                    <Input
                                        type={showCurrentPw ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="현재 비밀번호"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    >
                                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>새 비밀번호</Label>
                                <div className="relative">
                                    <Input
                                        type={showNewPw ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="8자 이상"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPw(!showNewPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    >
                                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>새 비밀번호 확인</Label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="새 비밀번호 재입력"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowPasswordChange(false);
                                        setCurrentPassword("");
                                        setNewPassword("");
                                        setConfirmPassword("");
                                    }}
                                >
                                    취소
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleChangePassword}
                                    disabled={changingPassword}
                                >
                                    {changingPassword ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {changingPassword ? "변경 중..." : "변경"}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* External Integrations - Coming Soon */}
            <Card className="opacity-60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                        외부 서비스 연동
                        <Badge variant="secondary" className="text-xs ml-auto">준비 중</Badge>
                    </CardTitle>
                    <CardDescription>아래 연동 기능은 향후 업데이트에서 제공됩니다</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                            <p className="text-sm font-medium">Gmail 연동</p>
                            <p className="text-xs text-muted-foreground">이메일 요약 및 일정 자동 추출</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <CalendarDays className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                            <p className="text-sm font-medium">Google 캘린더 연동</p>
                            <p className="text-xs text-muted-foreground">캘린더 일정 자동 동기화</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Hash className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                            <p className="text-sm font-medium">Slack 연동</p>
                            <p className="text-xs text-muted-foreground">미확인 메시지 요약 및 알림</p>
                        </div>
                    </div>
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
