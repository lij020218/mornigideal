import { NextResponse } from "next/server";
import { validateUser } from "@/lib/users";

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        const user = await validateUser(email, password);

        if (user) {
            return NextResponse.json({
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
            });
        }

        return NextResponse.json(null);
    } catch (error) {
        console.error("Validation error:", error);
        return NextResponse.json(null);
    }
}
