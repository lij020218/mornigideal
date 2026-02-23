"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sun, Target, User, MapPin, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfile, UserSettings, goalOptions, interestOptions, locationOptions } from "./settingsConstants";
import { SettingsRow } from "./SettingsShared";

interface ProfileTabProps {
    profile: UserProfile;
    setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    userSettings: UserSettings;
    setUserSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
    toggleInterest: (interest: string) => void;
}

export function ProfileTab({ profile, setProfile, userSettings, setUserSettings, toggleInterest }: ProfileTabProps) {
    return (
        <>
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
        </>
    );
}
