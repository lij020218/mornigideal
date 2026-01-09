"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface DataStats {
    totalEvents: number;
    totalDailyFeatures: number;
    totalWeeklyFeatures: number;
    dataRange: {
        oldest: string;
        newest: string;
    };
    usagePercentage: {
        events: number;
        daily: number;
        weekly: number;
    };
}

export function DataManagement() {
    const [stats, setStats] = useState<DataStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [lastCleanup, setLastCleanup] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/data-cleanup');
            if (response.ok) {
                const data = await response.json();
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch data stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCleanup = async () => {
        if (!confirm('오래된 데이터를 정리하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        try {
            setCleaning(true);
            const response = await fetch('/api/admin/data-cleanup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun: false }),
            });

            if (response.ok) {
                const data = await response.json();
                setLastCleanup(new Date().toISOString());
                alert(`정리 완료!\n삭제: ${data.report.totalRecordsDeleted}개\n집계: ${data.report.totalRecordsAggregated}개`);
                fetchStats(); // 통계 새로고침
            } else {
                alert('데이터 정리에 실패했습니다.');
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
            alert('오류가 발생했습니다.');
        } finally {
            setCleaning(false);
        }
    };

    const getUsageColor = (percentage: number) => {
        if (percentage >= 80) return 'text-red-500';
        if (percentage >= 60) return 'text-yellow-500';
        return 'text-green-500';
    };

    if (loading && !stats) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        데이터 관리
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    데이터 관리
                </CardTitle>
                <CardDescription>
                    저장된 데이터 현황 및 자동 정리 설정
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* 데이터 통계 */}
                {stats && (
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">이벤트 로그</span>
                                <span className={`text-sm font-bold ${getUsageColor(stats.usagePercentage.events)}`}>
                                    {stats.totalEvents.toLocaleString()} / 10,000
                                </span>
                            </div>
                            <Progress value={stats.usagePercentage.events} className="h-2" />
                            <p className="text-xs text-gray-500 mt-1">
                                {stats.usagePercentage.events.toFixed(1)}% 사용 중
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">일간 집계 데이터</span>
                                <span className={`text-sm font-bold ${getUsageColor(stats.usagePercentage.daily)}`}>
                                    {stats.totalDailyFeatures} / 365
                                </span>
                            </div>
                            <Progress value={stats.usagePercentage.daily} className="h-2" />
                            <p className="text-xs text-gray-500 mt-1">
                                {stats.usagePercentage.daily.toFixed(1)}% 사용 중
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">주간 집계 데이터</span>
                                <span className={`text-sm font-bold ${getUsageColor(stats.usagePercentage.weekly)}`}>
                                    {stats.totalWeeklyFeatures} / 104
                                </span>
                            </div>
                            <Progress value={stats.usagePercentage.weekly} className="h-2" />
                            <p className="text-xs text-gray-500 mt-1">
                                {stats.usagePercentage.weekly.toFixed(1)}% 사용 중
                            </p>
                        </div>

                        {/* 데이터 기간 */}
                        {stats.dataRange.oldest && (
                            <div className="pt-4 border-t">
                                <p className="text-xs text-gray-500">
                                    데이터 보관 기간: {new Date(stats.dataRange.oldest).toLocaleDateString()} ~ {new Date(stats.dataRange.newest).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* 자동 정리 안내 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-sm font-semibold text-blue-900">자동 데이터 정리</h4>
                            <p className="text-xs text-blue-700 mt-1">
                                매일 새벽 3시에 오래된 데이터가 자동으로 정리되고 있습니다.
                            </p>
                            <ul className="text-xs text-blue-600 mt-2 space-y-1 ml-4">
                                <li>• 90일 이상 지난 이벤트 → 일간 집계로 변환 후 삭제</li>
                                <li>• 1년 이상 지난 일간 데이터 → 주간 집계로 변환 후 삭제</li>
                                <li>• 중요한 이벤트 (목표 달성 등)는 더 오래 보관</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 수동 정리 버튼 */}
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchStats}
                        disabled={loading}
                        className="flex-1"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        새로고침
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleCleanup}
                        disabled={cleaning}
                        className="flex-1"
                    >
                        <Trash2 className={`w-4 h-4 mr-2 ${cleaning ? 'animate-pulse' : ''}`} />
                        {cleaning ? '정리 중...' : '지금 정리'}
                    </Button>
                </div>

                {lastCleanup && (
                    <p className="text-xs text-gray-500 text-center">
                        마지막 정리: {new Date(lastCleanup).toLocaleString()}
                    </p>
                )}

                {/* 경고 */}
                {stats && stats.usagePercentage.events >= 80 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-red-900">용량 부족 경고</h4>
                                <p className="text-xs text-red-700 mt-1">
                                    데이터 용량이 80%를 초과했습니다. 지금 정리를 실행하거나 자동 정리가 실행될 때까지 기다려주세요.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
