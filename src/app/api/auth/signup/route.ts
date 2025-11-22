import { NextResponse } from "next/server";
import { createUser, getUserByEmail, getUserByUsername } from "@/lib/users";

export async function POST(request: Request) {
    try {
        console.log('[Signup API] Starting signup process');

        const body = await request.json();
        console.log('[Signup API] Request body:', {
            hasName: !!body.name,
            hasUsername: !!body.username,
            hasEmail: !!body.email,
            hasPassword: !!body.password
        });

        const { name, username, email, password } = body;

        // Basic validation
        if (!name || !username || !email || !password) {
            console.error('[Signup API] Missing required fields');
            return NextResponse.json(
                { error: "모든 필드를 입력해주세요." },
                { status: 400 }
            );
        }

        console.log('[Signup API] Checking existing email:', email);
        // Check if email already exists
        const existingEmail = await getUserByEmail(email);
        if (existingEmail) {
            console.log('[Signup API] Email already exists');
            return NextResponse.json(
                { error: "이미 가입된 이메일입니다." },
                { status: 409 }
            );
        }

        console.log('[Signup API] Checking existing username:', username);
        // Check if username already exists
        const existingUsername = await getUserByUsername(username);
        if (existingUsername) {
            console.log('[Signup API] Username already exists');
            return NextResponse.json(
                { error: "이미 사용 중인 사용자명입니다." },
                { status: 409 }
            );
        }

        console.log('[Signup API] Creating new user');
        // Create user
        const newUser = await createUser({
            name,
            username,
            email,
            password, // Note: In production, hash this password!
        });

        console.log('[Signup API] User created successfully:', newUser.id);
        return NextResponse.json(newUser, { status: 201 });
    } catch (error: any) {
        console.error("[Signup API] Error:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            stack: error.stack
        });
        return NextResponse.json(
            {
                error: "회원가입 처리 중 오류가 발생했습니다.",
                details: error.message,
                code: error.code
            },
            { status: 500 }
        );
    }
}
