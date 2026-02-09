import { supabase } from './supabase';

interface UsageLog {
    user_email: string;
    model: string;
    endpoint: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost: number;
    timestamp: Date;
}

// Model pricing (per 1M tokens) - Updated 2026-01-12
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    // GPT-5 Series
    'gpt-5.2-2025-12-11': {
        input: 5.0,   // $5 per 1M input tokens
        output: 15.0, // $15 per 1M output tokens
    },
    'gpt-5.1-2025-11-13': {
        input: 10.0,  // $10 per 1M input tokens
        output: 30.0, // $30 per 1M output tokens
    },
    'gpt-5-mini-2025-08-07': {
        input: 0.10,  // $0.10 per 1M input tokens
        output: 0.40, // $0.40 per 1M output tokens
    },
    // GPT-4 Series
    'gpt-4o': {
        input: 5.0,   // $5 per 1M input tokens
        output: 15.0, // $15 per 1M output tokens
    },
    'gpt-4o-mini': {
        input: 0.15,  // $0.15 per 1M input tokens
        output: 0.6,  // $0.60 per 1M output tokens
    },
};

/**
 * Calculate the cost of an API call
 */
export function calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o'];

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
}

/**
 * Log OpenAI API usage to database and console
 */
export async function logOpenAIUsage(
    userEmail: string,
    model: string,
    endpoint: string,
    inputTokens: number,
    outputTokens: number
): Promise<void> {
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = calculateCost(model, inputTokens, outputTokens);

    const usageLog: UsageLog = {
        user_email: userEmail,
        model,
        endpoint,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        estimated_cost: estimatedCost,
        timestamp: new Date(),
    };

    // Console log for immediate visibility with color and formatting
    const costInWon = estimatedCost * 1335; // KRW conversion (approximate)
    const timestamp = new Date().toLocaleTimeString('ko-KR');

    console.log('');
    console.log('💰 ========================================');
    console.log(`⏰ ${timestamp}`);
    console.log(`📍 Endpoint: ${endpoint}`);
    console.log(`👤 User: ${userEmail?.substring(0, 3)}***`);
    console.log(`🤖 Model: ${model}`);
    console.log(`📊 Tokens:`);
    console.log(`   ↗️  Input:  ${inputTokens.toLocaleString()} tokens`);
    console.log(`   ↙️  Output: ${outputTokens.toLocaleString()} tokens`);
    console.log(`   📦 Total:  ${totalTokens.toLocaleString()} tokens`);
    console.log(`💵 Cost:`);
    console.log(`   $${estimatedCost.toFixed(6)} USD`);
    console.log(`   ₩${costInWon.toFixed(2)} KRW`);
    console.log('========================================');
    console.log('');

    // Log daily cumulative cost
    logDailyCumulativeCost(estimatedCost, totalTokens);

    // Store in database (create table if needed)
    try {
        const { error } = await supabase
            .from('openai_usage_logs')
            .insert([usageLog]);

        if (error) {
            console.error('[OpenAI Usage] Failed to log to database:', error);
        }
    } catch (error) {
        console.error('[OpenAI Usage] Database logging error:', error);
    }
}

/**
 * Log cumulative daily cost to console
 */
let dailyCumulativeCost = 0;
let dailyCumulativeTokens = 0;
let dailyCallCount = 0;
let lastResetDate = new Date().toDateString();

export function logDailyCumulativeCost(costToAdd: number, tokensToAdd: number): void {
    const today = new Date().toDateString();

    // Reset counters at midnight
    if (today !== lastResetDate) {
        dailyCumulativeCost = 0;
        dailyCumulativeTokens = 0;
        dailyCallCount = 0;
        lastResetDate = today;
    }

    dailyCumulativeCost += costToAdd;
    dailyCumulativeTokens += tokensToAdd;
    dailyCallCount++;

    const dailyCostInWon = dailyCumulativeCost * 1335;

    console.log('📈 ======== DAILY CUMULATIVE ========');
    console.log(`📅 Date: ${today}`);
    console.log(`🔢 Total API Calls Today: ${dailyCallCount}`);
    console.log(`📦 Total Tokens Today: ${dailyCumulativeTokens.toLocaleString()}`);
    console.log(`💰 Total Cost Today:`);
    console.log(`   $${dailyCumulativeCost.toFixed(6)} USD`);
    console.log(`   ₩${dailyCostInWon.toFixed(2)} KRW`);
    console.log('====================================');
    console.log('');
}

/**
 * Get usage statistics for a user
 */
export async function getUserUsageStats(
    userEmail: string,
    startDate?: Date,
    endDate?: Date
): Promise<{
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    byEndpoint: Record<string, { calls: number; tokens: number; cost: number }>;
}> {
    try {
        let query = supabase
            .from('openai_usage_logs')
            .select('*')
            .eq('user_email', userEmail);

        if (startDate) {
            query = query.gte('timestamp', startDate.toISOString());
        }
        if (endDate) {
            query = query.lte('timestamp', endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;

        const stats = {
            totalCalls: 0,
            totalTokens: 0,
            totalCost: 0,
            byEndpoint: {} as Record<string, { calls: number; tokens: number; cost: number }>,
        };

        data?.forEach((log: any) => {
            stats.totalCalls++;
            stats.totalTokens += log.total_tokens;
            stats.totalCost += log.estimated_cost;

            if (!stats.byEndpoint[log.endpoint]) {
                stats.byEndpoint[log.endpoint] = { calls: 0, tokens: 0, cost: 0 };
            }

            stats.byEndpoint[log.endpoint].calls++;
            stats.byEndpoint[log.endpoint].tokens += log.total_tokens;
            stats.byEndpoint[log.endpoint].cost += log.estimated_cost;
        });

        return stats;
    } catch (error) {
        console.error('[OpenAI Usage] Failed to get stats:', error);
        return {
            totalCalls: 0,
            totalTokens: 0,
            totalCost: 0,
            byEndpoint: {},
        };
    }
}
