import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { v4 as uuidv4 } from 'uuid';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Increase timeout for curriculum generation
export const maxDuration = 60; // 60 seconds
export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request: NextRequest, email: string) => {
    if (!process.env.GEMINI_API_KEY) {
        logger.error("[generate-curriculum] GEMINI_API_KEY is missing");
        return NextResponse.json({
            error: "Server configuration error: Missing API Key",
            hint: "Please set GEMINI_API_KEY environment variable in Vercel"
        }, { status: 500 });
    }

    const { job, goal, level } = await request.json();

    // 2. Generate Curriculum
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


    let result;
    try {
        result = await model.generateContent(prompt);
    } catch (apiError: any) {
        logger.error("[generate-curriculum] Gemini API call failed:", {
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

    // Clean up potential markdown formatting if the model includes it
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let curriculum;
    try {
        curriculum = JSON.parse(cleanedText);
    } catch (parseError) {
        logger.error('[generate-curriculum] Failed to parse response:', text.substring(0, 500));
        throw new Error('Failed to parse curriculum data');
    }

    // 3. Save to Supabase
    // Get user ID
    const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (userError || !userData) {
        logger.error("[generate-curriculum] User not found for email:", email);
        // We still return the curriculum to the frontend even if save fails, but log error
    } else {
        const curriculumId = uuidv4();
        const { error: saveError } = await supabaseAdmin
            .from("user_curriculums")
            .insert({
                user_id: userData.id,
                curriculum_id: curriculumId,
                curriculum_data: curriculum
            });

        if (saveError) {
            logger.error("[generate-curriculum] Failed to save to Supabase:", saveError);
        } else {
        }
    }

    return NextResponse.json({ curriculum });
});
