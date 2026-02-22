import { NextResponse } from "next/server";
import { createUser, getUserByEmail, getUserByUsername } from "@/lib/users";
import bcrypt from "bcryptjs";
import { signupSchema, validateBody } from '@/lib/schemas';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const v = validateBody(signupSchema, body);
        if (!v.success) return v.response;
        const { name, username, email, password } = v.data;

        const existingEmail = await getUserByEmail(email);
        if (existingEmail) {
            return NextResponse.json(
                { error: "이미 가입된 이메일입니다." },
                { status: 409 }
            );
        }

        const existingUsername = await getUserByUsername(username);
        if (existingUsername) {
            return NextResponse.json(
                { error: "이미 사용 중인 사용자명입니다." },
                { status: 409 }
            );
        }

        // 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = await createUser({
            name,
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
        });

        return NextResponse.json({
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
        }, { status: 201 });
    } catch (error: any) {
        console.error("[Signup API] Error:", error);
        return NextResponse.json(
            { error: "회원가입 처리 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
