import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
    try {
        const { job, goal, level } = await request.json();

        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-3-pro-preview" });

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up potential markdown formatting if the model includes it
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        const curriculum = JSON.parse(cleanedText);

        return NextResponse.json({ curriculum });
    } catch (error) {
        console.error("Error generating curriculum:", error);
        return NextResponse.json({ error: "Failed to generate curriculum" }, { status: 500 });
    }
}
