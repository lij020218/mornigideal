"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Clock } from "lucide-react";
import { toast } from "sonner";
import { NotificationSettings } from "./settingsConstants";
import { SettingsRow } from "./SettingsShared";

interface NotificationsTabProps {
    notifications: NotificationSettings;
    setNotifications: React.Dispatch<React.SetStateAction<NotificationSettings>>;
}

export function NotificationsTab({ notifications, setNotifications }: NotificationsTabProps) {
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary" />
                        일정 알림
                    </CardTitle>
                    <CardDescription>일정 시작 시 브라우저 알림을 받습니다</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                            일정 알림은 각 일정별로 설정됩니다. 일정을 추가하거나 수정할 때 알림 여부를 선택할 수 있습니다.
                        </p>
                    </div>
                    <SettingsRow
                        label="브라우저 알림 권한"
                        description="일정 알림을 받으려면 브라우저 알림을 허용해야 합니다"
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                if ("Notification" in window) {
                                    const permission = await Notification.requestPermission();
                                    if (permission === "granted") {
                                        new Notification("알림 테스트", {
                                            body: "알림이 정상적으로 작동합니다!",
                                        });
                                    } else {
                                        toast.warning("알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.");
                                    }
                                }
                            }}
                        >
                            알림 권한 요청
                        </Button>
                    </SettingsRow>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-5 h-5" />
                        추가 알림 기능
                    </CardTitle>
                    <CardDescription>아래 기능들은 준비 중입니다</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                    <SettingsRow
                        label="일일 학습 리마인더"
                        description="매일 아침 학습 알림을 받습니다"
                        badge="준비 중"
                    >
                        <Switch
                            checked={false}
                            disabled
                        />
                    </SettingsRow>

                    <SettingsRow
                        label="트렌드 알림"
                        description="관심 분야의 새로운 트렌드 소식"
                        badge="준비 중"
                    >
                        <Switch
                            checked={false}
                            disabled
                        />
                    </SettingsRow>

                    <SettingsRow
                        label="이메일 알림"
                        description="중요한 알림을 이메일로도 받습니다"
                        badge="준비 중"
                    >
                        <Switch
                            checked={false}
                            disabled
                        />
                    </SettingsRow>

                    <SettingsRow
                        label="알림 소리"
                        description="알림 시 소리를 재생합니다"
                        badge="준비 중"
                    >
                        <Switch
                            checked={false}
                            disabled
                        />
                    </SettingsRow>
                </CardContent>
            </Card>
        </>
    );
}
