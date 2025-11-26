import { config } from "dotenv";
config({ path: ".env.local" });
import { POST } from "../src/app/api/generate-curriculum/route";
import { supabase } from "../src/lib/supabase";

// Mock auth
jest.mock("@/auth", () => ({
    auth: async () => ({
        user: { email: "test@example.com" } // Ensure this user exists in your local DB or use a real one
    })
}));

// Since we can't easily mock auth in this standalone script without complex setup, 
// we will just check if the API *attempts* to save. 
// However, the API requires a valid session. 
// A better approach for this script is to mock the Request and see if it fails with 401 (Unauthorized) 
// which confirms auth check is in place, OR if we can simulate a session.

// For now, let's just run it and expect 401 or 500, but check logs.
// Actually, to properly test saving, we need a real user. 
// Let's assume the user from previous context exists or we fail gracefully.

async function testCurriculumSave() {
    console.log("Testing Curriculum Save...");

    const mockRequest = {
        json: async () => ({
            job: "Frontend Developer",
            goal: "Master React",
            level: "Beginner"
        })
    } as Request;

    try {
        // This will likely fail with 401 because we can't mock 'auth()' easily in this runtime 
        // without a proper test runner like Jest.
        // But we can check if the code compiles and runs.
        const response = await POST(mockRequest);
        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Data:", data);

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testCurriculumSave();
