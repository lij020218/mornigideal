import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
    try {
        // Enhanced logging for debugging
        console.log('[generate-quiz] Starting quiz generation request');
        console.log('[generate-quiz] API Key present:', !!process.env.GEMINI_API_KEY);
        console.log('[generate-quiz] Model:', process.env.GEMINI_MODEL || "gemini-2.0-flash-exp");

        if (!process.env.GEMINI_API_KEY) {
            console.error("[generate-quiz] GEMINI_API_KEY is missing");
            return NextResponse.json({
                error: "Server configuration error: Missing API Key",
                hint: "Please set GEMINI_API_KEY environment variable in Vercel"
            }, { status: 500 });
        }

        let body;
        try {
            body = await request.json();
        } catch (e) {
            console.error("[generate-quiz] Invalid JSON body:", e);
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { userType, major, field, goal } = body;
        console.log('[generate-quiz] Request params:', { userType, major, field, goal });

        if (!userType || !field || !goal) {
            console.error("[generate-quiz] Missing required fields:", { userType, field, goal });
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log('[generate-quiz] Initializing Gemini model...');
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const userContext = userType === "대학생"
            ? `전공: ${major}, 관심 분야: ${field}`
            : `업무 분야: ${field}`;

        const prompt = `
      You are an expert interviewer and skill assessor.
      The user has the following profile:
      - 유형: ${userType}
      ${major ? `- 전공: ${major}` : ''}
      - 분야: ${field}
      - 목표: ${goal}

      **TASK:**
      Generate a **10-question multiple-choice quiz** to assess the user's strengths and weaknesses in ${field}.

      **Requirements:**
      1. Questions should range from basic to advanced difficulty
      2. Questions should be practical and scenario-based, covering different aspects of ${field}
      3. Language: **Korean**
      4. Provide 4 options for each question
      5. Indicate the correct answer index (0-3)
      6. For ${userType === "대학생" ? "students" : "professionals"}, focus on ${userType === "대학생" ? "fundamental concepts and career preparation" : "practical workplace scenarios"}

      Return ONLY a valid JSON array of objects.
      Example:
      [
        {
          "question": "...",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "answer": 2
        }
      ]
    `;

        console.log(`[generate-quiz] Generating quiz for ${userType} in ${field}...`);

        let result;
        try {
            result = await model.generateContent(prompt);
        } catch (apiError: any) {
            console.error("[generate-quiz] Gemini API call failed:", {
                message: apiError.message,
                status: apiError.status,
                statusText: apiError.statusText,
                error: apiError
            });
            return NextResponse.json({
                error: "Gemini API call failed",
                details: apiError.message,
                hint: "Check if GEMINI_API_KEY is valid and model is accessible"
            }, { status: 500 });
        }

        const response = await result.response;
        const text = response.text();

        console.log('[generate-quiz] Received response from Gemini, length:', text?.length);

        if (!text) {
            console.error("[generate-quiz] Empty response from Gemini");
            throw new Error("Empty response from Gemini");
        }

        let quiz;
        try {
            const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            quiz = JSON.parse(cleanedText);
            console.log('[generate-quiz] Successfully parsed quiz with', quiz.length, 'questions');
        } catch (e) {
            console.error("[generate-quiz] Failed to parse Gemini response:", text.substring(0, 500));
            throw new Error("Failed to parse quiz data");
        }

        console.log('[generate-quiz] Quiz generation successful');
        return NextResponse.json({ quiz });
    } catch (error: any) {
        console.error("[generate-quiz] Error generating quiz:", {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return NextResponse.json({
            error: "Failed to generate quiz",
            details: error.message,
            errorType: error.name
        }, { status: 500 });
    }
}
