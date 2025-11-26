import { config } from "dotenv";
config({ path: ".env.local" });
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";

async function diagnose() {
    console.log("--- Diagnostic Start ---");
    const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    console.log("API Key present:", !!key);
    if (key) console.log("API Key prefix:", key.substring(0, 5) + "...");

    // 1. Test Gemini
    console.log("\n1. Testing Gemini API...");
    try {
        const genAI = new GoogleGenerativeAI(key || "");
        const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
        console.log("Model:", modelName);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say hello");
        console.log("Gemini Response:", result.response.text());
        console.log("✅ Gemini OK");
    } catch (e: any) {
        console.error("❌ Gemini Failed:", e.message || e);
        if (e.status) console.error("Status:", e.status);
    }

    // 2. Test YouTube
    console.log("\n2. Testing YouTube Data API...");
    try {
        const youtube = google.youtube({
            version: "v3",
            auth: key
        });
        const res = await youtube.search.list({
            part: ["snippet"],
            q: "Google Developers",
            maxResults: 1,
            type: ["video"]
        });
        console.log("YouTube Response Items:", res.data.items?.length);
        console.log("✅ YouTube OK");
    } catch (e: any) {
        console.error("❌ YouTube Failed:", e.message || e);
        if (e.code) console.error("Code:", e.code);
        if (e.errors) console.error("Errors:", JSON.stringify(e.errors, null, 2));
    }
}

diagnose();
