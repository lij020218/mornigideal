import { NextResponse } from "next/server";
import { validateUser } from "@/lib/users";

export async function POST(request: Request) {
    try {
        console.log('[validate] Starting user validation');
        console.log('[validate] Supabase URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
        console.log('[validate] Supabase Key present:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

        const { email, password } = await request.json();
        console.log('[validate] Validating user:', email);

        const user = await validateUser(email, password);

        if (user) {
            console.log('[validate] User validated successfully:', user.id);
            return NextResponse.json({
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
            });
        }

        console.log('[validate] User validation failed - invalid credentials');
        return NextResponse.json(null);
    } catch (error: any) {
        console.error("[validate] Error:", {
            message: error.message,
            stack: error.stack,
            name: error.name,
            error
        });
        return NextResponse.json(null);
    }
}
