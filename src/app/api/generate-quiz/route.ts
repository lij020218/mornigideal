import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
    try {
        const { userType, major, field, goal } = await request.json();

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const quiz = JSON.parse(cleanedText);

        return NextResponse.json({ quiz });
    } catch (error) {
        console.error("Error generating quiz:", error);
        return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
    }
}
