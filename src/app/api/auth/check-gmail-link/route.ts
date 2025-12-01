import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Check if user has linked Gmail account
        const { data, error } = await supabase
            .from("gmail_tokens")
            .select("gmail_email, expires_at")
            .eq("user_email", session.user.email)
            .single();

        if (error || !data) {
            return NextResponse.json({ linked: false });
        }

        // Check if token is expired
        const now = Date.now();
        if (data.expires_at < now) {
            return NextResponse.json({
                linked: true,
                gmailEmail: data.gmail_email,
                expired: true
            });
        }

        return NextResponse.json({
            linked: true,
            gmailEmail: data.gmail_email
        });
    } catch (error) {
        console.error("[Check Gmail Link] Error:", error);
        return NextResponse.json({ error: "Failed to check Gmail link" }, { status: 500 });
    }
}
