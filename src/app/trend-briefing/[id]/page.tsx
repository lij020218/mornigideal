"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { markTrendAsRead } from "@/lib/dailyGoals";

interface NewsDetail {
    title: string;
    content: string;
    keyTakeaways: string[];
    actionItems: string[];
    originalUrl: string;
}

export default function TrendBriefingDetailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [detail, setDetail] = useState<NewsDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasMarkedAsRead = useRef(false);

    const title = searchParams.get("title");
    const originalUrl = searchParams.get("url");
    const summary = searchParams.get("summary");
    const category = searchParams.get("category");
    const trendId = searchParams.get("id");

    // Mark trend as read when detail is loaded (for daily goals tracking)
    useEffect(() => {
        if (detail && trendId && !hasMarkedAsRead.current) {
            markTrendAsRead(trendId);
            hasMarkedAsRead.current = true;
        }
    }, [detail, trendId]);

    useEffect(() => {
        if (!title) {
            setError("뉴스 제목이 없습니다.");
            setLoading(false);
            return;
        }

        const fetchDetail = async () => {
            try {
                setLoading(true);

                // Check cache first
                const cacheKey = `trend_detail_${trendId || title}`;
                const cachedData = localStorage.getItem(cacheKey);

                if (cachedData) {
                    try {
                        const { detail: cachedDetail, timestamp } = JSON.parse(cachedData);
                        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // Cache for 1 week

                        // If cache is still valid, use it
                        if (Date.now() - timestamp < ONE_WEEK_MS) {
                            setDetail(cachedDetail);
                            setLoading(false);
                            return;
                        }
                    } catch (e) {
                        // Invalid cache, continue to fetch
                        localStorage.removeItem(cacheKey);
                    }
                }

                // Fetch from API if no cache or cache expired
                const response = await fetch("/api/trend-briefing", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title,
                        originalUrl,
                        summary,
                        trendId,
                        level: "Intermediate",
                        job: "Marketer"
                    })
                });

                if (!response.ok) throw new Error("뉴스 상세 정보를 가져올 수 없습니다.");

                const data = await response.json();
                setDetail(data.detail);

                // Save to cache
                localStorage.setItem(cacheKey, JSON.stringify({
                    detail: data.detail,
                    timestamp: Date.now()
                }));
            } catch (err) {
                setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [title, originalUrl, summary, trendId]);

    if (loading && !detail) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground">AI가 내용을 분석하고 재작성하고 있습니다...</p>
                    <p className="text-xs text-muted-foreground">처음 로딩 후에는 캐시되어 빠르게 표시됩니다</p>
                </div>
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="p-8 text-center space-y-4">
                    <p className="text-red-500">{error || "뉴스를 불러올 수 없습니다."}</p>
                    <Button onClick={() => router.back()}>돌아가기</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 glass border-b border-white/10 backdrop-blur-lg">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.back()}
                        className="gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        뒤로
                    </Button>
                    {category && (
                        <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                            {category}
                        </span>
                    )}
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
                {/* Title */}
                <div className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                        {detail.title}
                    </h1>
                    <p className="text-muted-foreground">AI가 당신의 수준에 맞춰 재작성했습니다</p>
                </div>

                {/* Main Content */}
                <Card className="glass-card border-none p-8 space-y-6">
                    <div
                        className="prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{
                            __html: detail.content
                                .replace(/^## /gm, '<h2 class="text-2xl font-bold mt-6 mb-4">')
                                .replace(/\n## /g, '</p><h2 class="text-2xl font-bold mt-6 mb-4">')
                                .replace(/\*\*(.+?)\*\*/g, '<strong class="text-primary font-semibold">$1</strong>')
                                .replace(/\n\n/g, '</p><p class="mb-4">')
                                .replace(/^(.)/gm, '<p class="mb-4">$1')
                                .replace(/<p class="mb-4"><h2/g, '<h2')
                        }}
                    />
                </Card>

                {/* Key Takeaways */}
                {detail.keyTakeaways && detail.keyTakeaways.length > 0 && (
                    <Card className="glass-card border-none p-8 space-y-4 bg-blue-500/5">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            핵심 요약
                        </h2>
                        <ul className="space-y-3">
                            {detail.keyTakeaways.map((takeaway, index) => (
                                <li key={index} className="flex gap-3">
                                    <span className="text-primary font-bold">•</span>
                                    <span>{takeaway}</span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}

                {/* Action Items */}
                {detail.actionItems && detail.actionItems.length > 0 && (
                    <Card className="glass-card border-none p-8 space-y-4 bg-purple-500/5">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            실행 가이드
                        </h2>
                        <ul className="space-y-3">
                            {detail.actionItems.map((action, index) => (
                                <li key={index} className="flex gap-3">
                                    <span className="text-purple-400 font-bold">{index + 1}.</span>
                                    <span>{action}</span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}

                {/* Original Source Link */}
                {detail.originalUrl && (
                    <Card className="glass-card border-none p-6 bg-gradient-to-r from-primary/10 to-transparent">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">원본 기사 출처</p>
                                <p className="text-sm font-mono text-primary truncate max-w-md">
                                    {detail.originalUrl}
                                </p>
                            </div>
                            <Link href={detail.originalUrl} target="_blank" rel="noopener noreferrer">
                                <Button className="gap-2">
                                    원문 보기
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                            </Link>
                        </div>
                    </Card>
                )}
            </main>
        </div>
    );
}
