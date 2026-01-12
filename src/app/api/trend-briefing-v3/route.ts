import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Enhanced Trend Briefing API (v3)
 *
 * Improvements:
 * - Uses user behavioral data to personalize content
 * - Learns from reading patterns
 * - Prioritizes categories user engages with
 * - Filters out uninteresting topics
 */

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const job = searchParams.get('job') || 'Professional';
        const goal = searchParams.get('goal') || '';
        const interests = searchParams.get('interests')?.split(',').filter(Boolean) || [];

        console.log('[Trend Briefing v3] Generating personalized briefings for:', session.user.email);

        // Fetch user behavioral data
        const { data: activities } = await supabase
            .from('user_activity_logs')
            .select('*')
            .eq('user_email', session.user.email)
            .eq('activity_type', 'briefing_read')
            .order('timestamp', { ascending: false })
            .limit(50);

        // Analyze reading patterns
        const readingPreferences = analyzeReadingPatterns(activities || []);

        console.log('[Trend Briefing v3] User reading preferences:', readingPreferences);

        // Fetch existing briefings from today
        const today = new Date().toISOString().split('T')[0];
        const { data: existingBriefings } = await supabase
            .from('trend_briefings')
            .select('*')
            .eq('user_email', session.user.email)
            .gte('created_at', `${today}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`);

        if (existingBriefings && existingBriefings.length >= 5) {
            console.log('[Trend Briefing v3] Using cached briefings');
            return NextResponse.json({ trends: existingBriefings });
        }

        // Generate personalized briefing prompt
        const prompt = generatePersonalizedPrompt(job, goal, interests, readingPreferences);

        const modelName = "gpt-5.2-2025-12-11";
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: "You are an AI trend analyst who creates highly personalized news briefings based on user preferences and reading patterns."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.8,
        });

        const responseText = completion.choices[0]?.message?.content || '[]';

        // Log usage
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email,
                modelName,
                '/api/trend-briefing-v3',
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        // Parse and save briefings
        let trends = [];
        try {
            trends = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Trend Briefing v3] Parse error:', parseError);
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                trends = JSON.parse(jsonMatch[0]);
            }
        }

        // Save to database
        const briefingsToSave = trends.map((trend: any) => ({
            user_email: session.user.email,
            title: trend.title,
            summary: trend.summary,
            category: trend.category || 'uncategorized',
            keywords: trend.keywords || [],
            source: trend.source || 'AI Generated',
            relevance_score: calculateRelevanceScore(trend, readingPreferences),
            created_at: new Date().toISOString(),
        }));

        if (briefingsToSave.length > 0) {
            await supabase.from('trend_briefings').insert(briefingsToSave);
        }

        return NextResponse.json({ trends: briefingsToSave });
    } catch (error: any) {
        console.error('[Trend Briefing v3] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function analyzeReadingPatterns(activities: any[]) {
    const categoryCount: Record<string, number> = {};
    const keywordCount: Record<string, number> = {};
    let totalReads = 0;

    activities.forEach(activity => {
        totalReads++;
        const metadata = activity.metadata || {};

        // Count categories
        const category = metadata.category || 'uncategorized';
        categoryCount[category] = (categoryCount[category] || 0) + 1;

        // Count keywords
        (metadata.keywords || []).forEach((keyword: string) => {
            keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
        });
    });

    // Get top categories and keywords
    const topCategories = Object.entries(categoryCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat, count]) => ({ category: cat, count, percentage: (count / totalReads) * 100 }));

    const topKeywords = Object.entries(keywordCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([keyword]) => keyword);

    return {
        topCategories,
        topKeywords,
        totalReads,
        hasEnoughData: totalReads >= 5,
    };
}

function generatePersonalizedPrompt(
    job: string,
    goal: string,
    interests: string[],
    preferences: any
) {
    const basePrompt = `Generate 5 trend briefings for a user with:
- Job: ${job}
- Goal: ${goal}
- Interests: ${interests.join(', ')}

${preferences.hasEnoughData ? `
**IMPORTANT - User Reading Patterns:**
The user has read ${preferences.totalReads} briefings. Strongly prefer these categories:
${preferences.topCategories.map((c: any) => `- ${c.category} (${c.percentage.toFixed(0)}% of reads)`).join('\n')}

User frequently engages with: ${preferences.topKeywords.join(', ')}

**Personalization Rules:**
1. Prioritize content from top categories (${preferences.topCategories.map((c: any) => c.category).join(', ')})
2. Include keywords user engages with: ${preferences.topKeywords.slice(0, 5).join(', ')}
3. Avoid generic content - user prefers specific, actionable insights
4. Match the depth/complexity user has shown interest in
` : `
**Note:** Not enough reading history yet. Focus on user's stated interests and goal.
`}

**Output Format (JSON):**
[
  {
    "title": "Engaging title",
    "summary": "2-3 sentences with actionable insights",
    "category": "tech|business|ai|startup|finance|health|etc",
    "keywords": ["keyword1", "keyword2"],
    "source": "Relevant source name"
  }
]

**Requirements:**
- All content must be relevant to user's ${goal ? `goal (${goal})` : 'interests'}
- Vary categories but prioritize user preferences
- Include specific data points, numbers, names
- Make each briefing actionable`;

    return basePrompt;
}

function calculateRelevanceScore(briefing: any, preferences: any): number {
    let score = 50; // Base score

    if (!preferences.hasEnoughData) {
        return score; // Default score if no reading history
    }

    // Boost score if category matches preferences
    const matchingCategory = preferences.topCategories.find(
        (c: any) => c.category === briefing.category
    );
    if (matchingCategory) {
        score += matchingCategory.percentage; // Add 0-100 based on preference strength
    }

    // Boost score for each matching keyword
    (briefing.keywords || []).forEach((keyword: string) => {
        if (preferences.topKeywords.includes(keyword)) {
            score += 5;
        }
    });

    return Math.min(100, score); // Cap at 100
}
