import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { job, goal, interests, exclude = [] } = await request.json();

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
You are a helpful content curator for a ${job} whose goal is "${goal}".
The user is interested in: ${interests.join(", ")}.

Your task is to recommend 3 specific, high-quality YouTube videos that would be helpful or inspiring for them right now.

**CRITICAL INSTRUCTIONS FOR ACCURACY:**
1. **NO HALLUCINATIONS:** You must ONLY recommend videos that you are **100% CERTAIN exist**.
2. **EXACT TITLES:** Do NOT invent or paraphrase titles. You must use the **EXACT original video title** as it appears on YouTube.
3. **POPULARITY:** If you are unsure about a specific niche video, choose a well-known, high-viewcount video from a famous channel (e.g., TED, EO, Y Combinator, Sebasi, etc.) that matches the topic.
4. **UNIQUENESS:** Do NOT recommend the following videos (user has already seen them):
   ${exclude.join(", ")}

**REQUIREMENTS:**
1. Recommend exactly 3 videos.
2. Output must be in Korean (translate description/reason, but keep English titles if the original is English).
3. Diverse topics based on their interests.

**REQUIRED OUTPUT (JSON):**
{
  "recommendations": [
    {
      "id": "unique_id_1",
      "title": "Exact Video Title",
      "channel": "Channel Name",
      "type": "youtube",
      "tags": ["Tag1", "Tag2"],
      "duration": "Estimated Duration (e.g. 15:00)",
      "description": "Why this video is recommended for them (1 sentence)."
    }
  }
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean up markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();

    let data;
    try {
      data = JSON.parse(cleanText);
    } catch (e) {
      console.error("Failed to parse recommendation JSON. Raw text:", text);
      return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}
