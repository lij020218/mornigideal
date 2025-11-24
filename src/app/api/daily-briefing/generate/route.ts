import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
    try {
        const { userProfile, yesterdayGoals, todaySchedule, yesterdayTrends } = await request.json();

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
You are an inspiring personal mentor for a ${userProfile.level} ${userProfile.job}.
The user has just woken up. Your goal is to review yesterday's performance, summarize key news they missed while sleeping (or from yesterday), and motivate them for today.

**USER CONTEXT:**
- Job: ${userProfile.job}
- Goal: ${userProfile.goal}
- Yesterday's Goals: ${JSON.stringify(yesterdayGoals)}
- Today's Schedule: ${JSON.stringify(todaySchedule)}

**YESTERDAY'S TRENDS (News from the last 24h):**
${JSON.stringify(yesterdayTrends?.slice(0, 6) || [])}

**YOUR MISSION:**
Generate a structured morning briefing in Korean.

**REQUIRED OUTPUT (JSON):**
{
  "greeting": "Warm, personalized morning greeting (e.g., 'Good Morning, [Name]! Ready to grow today?')",
  "yesterdayReview": "1-2 sentences reviewing yesterday's goal completion. Be encouraging but honest. If they missed goals, suggest how to recover today.",
  "trendSummary": [
    "Bullet point 1: Key insight from yesterday's news relevant to ${userProfile.job}",
    "Bullet point 2: Another key insight",
    "Bullet point 3: Final key insight"
  ],
  "todayFocus": "Advice for today's schedule. Highlight the most important task or mindset based on their schedule.",
  "closing": "A short, punchy closing statement to start the day with energy."
}

**TONE:**
- Professional yet warm
- Motivating and actionable
- Korean language (natural and fluent)
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse briefing JSON", e);
            return NextResponse.json({ error: "Failed to generate briefing" }, { status: 500 });
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error("Error generating daily briefing:", error);
        return NextResponse.json({ error: "Failed to generate briefing" }, { status: 500 });
    }
}
