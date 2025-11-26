import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: material, error } = await supabase
            .from("materials")
            .select("*")
            .eq("id", params.id)
            .eq("user_id", session.user.email)
            .single();

        if (error || !material) {
            return NextResponse.json({ error: "Material not found" }, { status: 404 });
        }

        return NextResponse.json(material);
    } catch (error) {
        console.error("Get material error:", error);
        return NextResponse.json({ error: "Failed to get material" }, { status: 500 });
    }
}
