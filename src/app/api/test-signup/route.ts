import { NextResponse } from "next/server";

export async function GET() {
    // 프로덕션에서 디버그 엔드포인트 차단
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    try {
        console.log('[Test Signup] Environment check');

        const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
        const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const hasAuthSecret = !!process.env.AUTH_SECRET;

        console.log('[Test Signup] NEXT_PUBLIC_SUPABASE_URL:', hasSupabaseUrl);
        console.log('[Test Signup] NEXT_PUBLIC_SUPABASE_ANON_KEY:', hasSupabaseKey);
        console.log('[Test Signup] AUTH_SECRET:', hasAuthSecret);

        if (hasSupabaseUrl) {
            console.log('[Test Signup] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
        }

        return NextResponse.json({
            status: "ok",
            env: {
                NEXT_PUBLIC_SUPABASE_URL: hasSupabaseUrl ? "✓" : "✗",
                NEXT_PUBLIC_SUPABASE_ANON_KEY: hasSupabaseKey ? "✓" : "✗",
                AUTH_SECRET: hasAuthSecret ? "✓" : "✗"
            },
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET"
        });
    } catch (error: any) {
        console.error('[Test Signup] Error:', error);
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
