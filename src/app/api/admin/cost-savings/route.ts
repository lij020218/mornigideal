import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const GET = withAuth(async (request: NextRequest, userEmail: string) => {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';

    let startDate: Date | undefined;
    const endDate = new Date();

    switch (period) {
        case 'today':
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'week':
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'month':
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            break;
    }

    // Get AI usage logs
    let query = supabaseAdmin
        .from('openai_usage_logs')
        .select('*')
        .eq('user_email', userEmail);

    if (startDate) {
        query = query.gte('timestamp', startDate.toISOString());
    }

    const { data: aiLogs, error: aiError } = await query;
    if (aiError) throw aiError;

    // Get request logs to calculate rule-based vs AI ratio
    // For now, we'll estimate based on AI calls
    // In production, you'd want to track all requests

    const totalAICalls = aiLogs?.length || 0;
    const totalAICost = aiLogs?.reduce((sum, log) => sum + parseFloat(log.estimated_cost), 0) || 0;

    // Estimate total requests (assuming 40% are handled by rules)
    const estimatedRuleBasedCalls = Math.round(totalAICalls * 0.67); // 40% rule-based = 60% AI
    const estimatedTotalCalls = totalAICalls + estimatedRuleBasedCalls;

    const avgAICostPerCall = totalAICalls > 0 ? totalAICost / totalAICalls : 0.024;
    const estimatedSavedCost = estimatedRuleBasedCalls * avgAICostPerCall;
    const savingsPercentage = estimatedTotalCalls > 0
        ? (estimatedRuleBasedCalls / estimatedTotalCalls) * 100
        : 0;

    return NextResponse.json({
        period,
        startDate: startDate?.toISOString(),
        endDate: endDate.toISOString(),
        stats: {
            totalRequests: estimatedTotalCalls,
            aiCalls: totalAICalls,
            ruleBasedCalls: estimatedRuleBasedCalls,
            totalAICost,
            estimatedSavedCost,
            savingsPercentage,
            netCost: totalAICost, // What we actually paid
            wouldHaveCost: totalAICost + estimatedSavedCost, // What we would have paid without rules
        },
        summary: {
            message: `규칙 기반 처리로 약 $${estimatedSavedCost.toFixed(4)} 절약했습니다! (${savingsPercentage.toFixed(1)}% 절감)`,
            recommendations: [
                savingsPercentage < 30 ? "더 많은 규칙 기반 패턴을 추가하면 비용을 더 절감할 수 있습니다." : null,
                totalAICost > 5 ? "GPT-4o-mini 모델 사용을 고려해보세요." : null,
            ].filter(Boolean),
        }
    });
});
