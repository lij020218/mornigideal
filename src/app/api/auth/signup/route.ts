import { NextResponse } from "next/server";
import { createUser, getUserByEmail, getUserByUsername } from "@/lib/users";
import { z } from "zod";

const signupSchema = z.object({
    name: z.string().min(1, "이름을 입력해주세요."),
    username: z
        .string()
        .min(2, "사용자명은 2자 이상이어야 합니다.")
        .max(20, "사용자명은 20자 이하여야 합니다.")
        .regex(/^[a-zA-Z0-9_]+$/, "영문, 숫자, 밑줄(_)만 사용 가능합니다."),
    email: z.string().email("올바른 이메일 형식이 아닙니다."),
    password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = signupSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.errors[0].message },
                { status: 400 }
            );
        }

        const { name, username, email, password } = result.data;

        // Check if email already exists
        const existingEmail = await getUserByEmail(email);
        if (existingEmail) {
            return NextResponse.json(
                { error: "이미 사용 중인 이메일입니다." },
                { status: 400 }
            );
        }

        // Check if username already exists
        const existingUsername = await getUserByUsername(username);
        if (existingUsername) {
            return NextResponse.json(
                { error: "이미 사용 중인 사용자명입니다." },
                { status: 400 }
            );
        }

        // Create user
        const user = await createUser({
            name,
            username,
            email,
            password, // In production, hash this!
        });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        console.error("Signup error:", error);
        return NextResponse.json(
            { error: "회원가입 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
