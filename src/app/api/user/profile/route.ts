import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const profileData = await request.json();

        // Update user profile in Supabase
        const { data, error } = await supabase
            .from('users')
            .update({
                profile: profileData,
                updated_at: new Date().toISOString()
            })
            .eq('email', session.user.email)
            .select()
            .single();

        if (error) {
            console.error('[Profile API] Error updating profile:', error);
            return NextResponse.json(
                { error: "Failed to update profile" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, profile: data.profile });
    } catch (error: any) {
        console.error("[Profile API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { data, error } = await supabase
            .from('users')
            .select('profile')
            .eq('email', session.user.email)
            .single();

        if (error) {
            console.error('[Profile API] Error fetching profile:', error);
            return NextResponse.json(
                { error: "Failed to fetch profile" },
                { status: 500 }
            );
        }

        return NextResponse.json({ profile: data.profile });
    } catch (error: any) {
        console.error("[Profile API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
