"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sun, Palette, Moon, Monitor, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppearanceSettings } from "./settingsConstants";

interface AppearanceTabProps {
    appearance: AppearanceSettings;
    setAppearance: React.Dispatch<React.SetStateAction<AppearanceSettings>>;
}

export function AppearanceTab({ appearance, setAppearance }: AppearanceTabProps) {
    return (
        <>
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

                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Languages className="w-5 h-5 text-muted-foreground" />
                        언어
                        <Badge variant="secondary" className="text-xs ml-auto">준비 중</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 opacity-50">
                        {[
                            { id: "ko", label: "한국어", flag: "🇰🇷" },
                            { id: "en", label: "English", flag: "🇺🇸" },
                        ].map((lang) => (
                            <button
                                key={lang.id}
                                disabled
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl transition-all border cursor-not-allowed",
                                    lang.id === "ko"
                                        ? "bg-primary/10 border-primary"
                                        : "bg-muted/50 border-transparent"
                                )}
                            >
                                <span>{lang.flag}</span>
                                <span className="font-medium">{lang.label}</span>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
