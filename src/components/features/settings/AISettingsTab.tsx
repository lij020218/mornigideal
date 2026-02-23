"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Brain, Zap, Target, BookOpen, Key } from "lucide-react";
import { cn } from "@/lib/utils";
import { AISettings } from "./settingsConstants";
import { SettingsRow } from "./SettingsShared";
import { APIKeySettings } from "./APIKeySettings";

interface AISettingsTabProps {
    aiSettings: AISettings;
    setAISettings: React.Dispatch<React.SetStateAction<AISettings>>;
}

export function AISettingsTab({ aiSettings, setAISettings }: AISettingsTabProps) {
    return (
        <>
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
                    >
                        <Switch
                            checked={aiSettings.proactiveInsights}
                            onCheckedChange={(checked) => setAISettings({ ...aiSettings, proactiveInsights: checked })}
                        />
                    </SettingsRow>
                </CardContent>
            </Card>

            {/* BYOK - API 키 설정 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-primary" />
                        API 키 설정 (BYOK)
                    </CardTitle>
                    <CardDescription>나만의 API 키로 무제한 AI 사용</CardDescription>
                </CardHeader>
                <CardContent>
                    <APIKeySettings />
                </CardContent>
            </Card>
        </>
    );
}
