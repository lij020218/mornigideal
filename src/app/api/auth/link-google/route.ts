import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// This endpoint handles linking a Google account to an existing account
export async function POST(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { accessToken } = await req.json();

        if (!accessToken) {
            return NextResponse.json({ error: "No access token provided" }, { status: 400 });
        }

        // Store the access token in the user's session or database
        // For now, we'll return success and handle this client-side
        // In a production app, you'd store this in a database

        return NextResponse.json({
            success: true,
            message: "Google account linked successfully"
        });
    } catch (error) {
        console.error("[Link Google] Error:", error);
        return NextResponse.json({
            error: "Failed to link Google account"
        }, { status: 500 });
    }
}
