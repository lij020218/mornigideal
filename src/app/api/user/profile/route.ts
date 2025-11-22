import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByEmail } from "@/lib/users";

export async function GET() {
    try {
        const session = await auth();

        if (!session || !session.user || !session.user.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const user = await getUserByEmail(session.user.email);

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            profile: user.profile || {}
        });
    } catch (error: any) {
        console.error("[Profile API] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch profile" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session || !session.user || !session.user.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { profile } = await request.json();

        // Update user profile in database
        const { supabase } = await import("@/lib/supabase");

        const { data, error } = await supabase
            .from("users")
            .update({ profile })
            .eq("email", session.user.email)
            .select()
            .single();

        if (error) {
            console.error("[Profile API] Update error:", error);
            return NextResponse.json(
                { error: "Failed to update profile" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            profile: data.profile
        });
    } catch (error: any) {
        console.error("[Profile API] Error:", error);
        return NextResponse.json(
            { error: "Failed to update profile" },
            { status: 500 }
        );
    }
}
