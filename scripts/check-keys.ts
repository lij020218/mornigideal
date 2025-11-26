import { config } from "dotenv";
config({ path: ".env.local" });

console.log("Checking keys...");
const googleKey = process.env.GOOGLE_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

console.log("GOOGLE_API_KEY present:", !!googleKey);
console.log("GEMINI_API_KEY present:", !!geminiKey);

if (googleKey && geminiKey) {
    if (googleKey === geminiKey) {
        console.log("Keys are IDENTICAL.");
    } else {
        console.log("Keys are DIFFERENT.");
        console.log("Note: The app prioritizes GOOGLE_API_KEY.");
    }
}
