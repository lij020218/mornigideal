import { NextResponse } from "next/server";
import { createUser, getUserByEmail, getUserByUsername } from "@/lib/users";

export async function POST(request: Request) {
    try {
        const { name, username, email, password } = await request.json();

        // Basic validation
        if (!name || !username || !email || !password) {
            return NextResponse.json(
                { error: "모든 필드를 입력해주세요." },
                { status: 400 }
            );
        }

        // Check if email already exists
        const existingEmail = await getUserByEmail(email);
        if (existingEmail) {
            return NextResponse.json(
                { error: "이미 가입된 이메일입니다." },
                { status: 409 }
            );
        }

        // Check if username already exists
        const existingUsername = await getUserByUsername(username);
        if (existingUsername) {
            return NextResponse.json(
                { error: "이미 사용 중인 사용자명입니다." },
                { status: 409 }
            );
        }

        // Create user
        const newUser = await createUser({
            name,
            username,
            email,
            password, // Note: In production, hash this password!
        });

        return NextResponse.json(newUser, { status: 201 });
    } catch (error: any) {
        console.error("[Signup API] Error:", error);
        return NextResponse.json(
            { error: "회원가입 처리 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
