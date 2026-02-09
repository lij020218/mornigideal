import { config } from "dotenv";
config({ path: ".env.local" });
import { POST } from "../src/app/api/recommendations/generate/route";

console.log("--- Environment Check ---");
console.log("YOUTUBE_API_KEY present:", !!process.env.YOUTUBE_API_KEY);
console.log("GOOGLE_API_KEY present:", !!process.env.GOOGLE_API_KEY);
console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);
console.log("-------------------------");


async function testRecommendations() {
    console.log("Testing Recommendation API...");

    const mockRequest = {
        json: async () => ({
            job: "Frontend Developer",
            goal: "Master React",
            interests: ["React Server Components", "Performance"],
            exclude: []
        }),
        headers: new Headers(),
        nextUrl: new URL("http://localhost:3000/api/recommendations/generate"),
    } as any;

    try {
        const response = await POST(mockRequest);
        const data = await response.json();

        if (data.error) {
            console.error("API Error:", data.error);
        } else {
            console.log("Success! Received recommendations:");
            console.log(JSON.stringify(data, null, 2));

            // Basic validation
            if (data.recommendations && data.recommendations.length > 0) {
                const first = data.recommendations[0];
                if (first.id && first.title && first.title !== "Unknown Title") {
                    console.log("✅ Validation Passed: Video has ID and Title.");
                } else {
                    console.error("❌ Validation Failed: Video missing ID or Title.");
                }
            } else {
                console.error("❌ Validation Failed: No recommendations returned.");
            }
        }
    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testRecommendations();
