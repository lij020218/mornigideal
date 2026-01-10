"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, Target, Award, BookOpen, CheckCircle2, Trophy, TrendingUp } from "lucide-react";
import Link from "next/link";

interface UserProfile {
    job: string;
    goal: string;
    level: string;
}

interface CurriculumItem {
    title: string;
    description: string;
    duration: string;
    topics?: string[];
}

interface MyPageContentProps {
    username: string;
    email: string;
}

const goalLabels: Record<string, string> = {
    expert: "업계 최고의 전문가 되기",
    promotion: "빠른 승진 및 연봉 인상",
    switch: "성공적인 직무 전환",
};

const levelLabels: Record<string, string> = {
    junior: "주니어",
    mid: "미드레벨",
    senior: "시니어",
};

export function MyPageContent({ username, email }: MyPageContentProps) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [curriculum, setCurriculum] = useState<CurriculumItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load user data from localStorage
        const savedProfile = localStorage.getItem("user_profile");
        const savedCurriculum = localStorage.getItem("user_curriculum");

        if (savedProfile) {
            setProfile(JSON.parse(savedProfile));
        }
        if (savedCurriculum) {
            setCurriculum(JSON.parse(savedCurriculum));
        }
        setLoading(false);
    }, []);

    if (loading) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-white/10 rounded w-48" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-40 bg-white/10 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 pt-20 md:pt-6 max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <header className="flex items-center gap-4">
                <Link href="/dashboard">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">마이페이지</h1>
                    <p className="text-muted-foreground">{email}</p>
                </div>
            </header>

            {/* Profile Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* User Info Card */}
                <Card className="glass-card border-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-xl font-bold">
                                {username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-bold">{username}</p>
                                <p className="text-sm text-muted-foreground font-normal">
                                    {profile?.level ? levelLabels[profile.level] || profile.level : "레벨 미설정"}
                                </p>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            <span>성장 여정을 시작하세요</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Job Card */}
                <Card className="glass-card border-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Briefcase className="w-5 h-5 text-primary" />
                            나의 직업
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {profile?.job || "미설정"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                            {profile?.level ? `${levelLabels[profile.level] || profile.level} 레벨` : "온보딩을 완료해주세요"}
                        </p>
                    </CardContent>
                </Card>

                {/* Level Card */}
                <Card className="glass-card border-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Award className="w-5 h-5 text-primary" />
                            나의 수준
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {profile?.level ? levelLabels[profile.level] || profile.level : "미설정"}
                        </p>
                        <div className="mt-3">
                            <div className="flex gap-1">
                                {["junior", "mid", "senior"].map((level) => (
                                    <div
                                        key={level}
                                        className={`h-2 flex-1 rounded-full ${
                                            profile?.level === level
                                                ? "bg-primary"
                                                : profile?.level === "senior" || (profile?.level === "mid" && level !== "senior")
                                                    ? "bg-primary/50"
                                                    : "bg-white/10"
                                        }`}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>주니어</span>
                                <span>미드</span>
                                <span>시니어</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Goal Card */}
                <Card className="glass-card border-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Target className="w-5 h-5 text-primary" />
                            나의 목표
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-bold">
                            {profile?.goal ? goalLabels[profile.goal] || profile.goal : "미설정"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                            목표 달성까지 화이팅!
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Curriculum Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    생성된 커리큘럼
                </h2>
                {curriculum.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {curriculum.map((item, index) => (
                            <Card key={index} className="glass-card border-none">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                            <span className="text-primary font-bold">{index + 1}</span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg">{item.title}</h3>
                                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                            {item.duration && (
                                                <p className="text-xs text-primary mt-2">예상 소요시간: {item.duration}</p>
                                            )}
                                            {item.topics && item.topics.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {item.topics.map((topic, i) => (
                                                        <span
                                                            key={i}
                                                            className="text-xs px-2 py-1 bg-white/10 rounded-full"
                                                        >
                                                            {topic}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="glass-card border-none">
                        <CardContent className="p-8 text-center">
                            <p className="text-muted-foreground">
                                아직 생성된 커리큘럼이 없습니다.
                            </p>
                            <Link href="/onboarding">
                                <Button className="mt-4">온보딩 시작하기</Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}
            </section>

            {/* Achievements Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    달성한 목표
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="glass-card border-none">
                        <CardContent className="p-4 text-center">
                            <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
                            <p className="text-2xl font-bold">-</p>
                            <p className="text-sm text-muted-foreground">연속 학습일</p>
                        </CardContent>
                    </Card>
                    <Card className="glass-card border-none">
                        <CardContent className="p-4 text-center">
                            <BookOpen className="w-8 h-8 text-green-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold">-</p>
                            <p className="text-sm text-muted-foreground">완료한 강의</p>
                        </CardContent>
                    </Card>
                    <Card className="glass-card border-none">
                        <CardContent className="p-4 text-center">
                            <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold">-</p>
                            <p className="text-sm text-muted-foreground">획득한 배지</p>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    );
}
