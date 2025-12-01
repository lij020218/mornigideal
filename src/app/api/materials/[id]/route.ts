import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: material, error } = await supabase
      .from("materials")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.email)
      .single();

    if (error || !material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ material });
  } catch (error: any) {
    console.error("[GET MATERIAL ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch material", details: error.message },
      { status: 500 }
    );
  }
}
