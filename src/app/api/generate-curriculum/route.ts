import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
    try {
        console.log('[generate-curriculum] Starting curriculum generation');
        console.log('[generate-curriculum] API Key present:', !!process.env.GEMINI_API_KEY);

        if (!process.env.GEMINI_API_KEY) {
            console.error("[generate-curriculum] GEMINI_API_KEY is missing");
            return NextResponse.json({
                error: "Server configuration error: Missing API Key",
                hint: "Please set GEMINI_API_KEY environment variable in Vercel"
            }, { status: 500 });
        }

        const { job, goal, level } = await request.json();
        console.log('[generate-curriculum] Request params:', { job, goal, level });

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-3-pro-preview",
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const prompt = `
      You are an expert career coach and curriculum designer.
      Create a personalized learning curriculum for a user with the following profile:
      - Job/Status: ${job}
      - Goal: ${goal}
      - Level: ${level}

      IMPORTANT: Consider the user's current status carefully:
      - If they are a "대학생" (university student), focus on skills relevant to their goal and future career preparation
      - If they are a "직장인" (office worker), focus on immediate professional development and career advancement
      - If they mention specific roles or industries, tailor the courses to those areas

      Generate 3 specific learning courses/subjects that are:
      1. Highly relevant to their stated goal
      2. Appropriate for their current level
      3. Practical and actionable

      Each course should have:
      - title: A catchy, clear title (in Korean) that matches their goal and status
      - subtitle: Brief description of what they'll learn (in Korean)
      - icon: A suggestion for a Lucide icon name (e.g., "BookOpen", "Target", "TrendingUp", "Code", "Briefcase")
      - totalDays: Recommended number of days to complete this course (between 7 and 30 days, based on complexity)

      Return the response ONLY as a valid JSON array of objects. Do not include markdown formatting or code blocks.
      Example format:
      [
        { "title": "마케팅 기초", "subtitle": "디지털 마케팅의 핵심 개념", "icon": "BookOpen", "totalDays": 14 },
        ...
      ]
    `;

        console.log('[generate-curriculum] Calling Gemini API...');

        let result;
        try {
            result = await model.generateContent(prompt);
        } catch (apiError: any) {
            console.error("[generate-curriculum] Gemini API call failed:", {
                message: apiError.message,
                status: apiError.status,
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

        console.log('[generate-curriculum] Received response, length:', text?.length);

        // Clean up potential markdown formatting if the model includes it
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        let curriculum;
        try {
            curriculum = JSON.parse(cleanedText);
            console.log('[generate-curriculum] Successfully parsed', curriculum.length, 'courses');
        } catch (parseError) {
            console.error('[generate-curriculum] Failed to parse response:', text.substring(0, 500));
            throw new Error('Failed to parse curriculum data');
        }

        console.log('[generate-curriculum] Curriculum generation successful');
        return NextResponse.json({ curriculum });
    } catch (error: any) {
        console.error("[generate-curriculum] Error:", {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return NextResponse.json({
            error: "Failed to generate curriculum",
            details: error.message,
            errorType: error.name
        }, { status: 500 });
    }
}
