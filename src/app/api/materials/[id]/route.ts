import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from '@/lib/supabase-admin';

export const GET = withAuth(async (
  request: NextRequest,
  email: string,
) => {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();

  const { data: material, error } = await supabaseAdmin
    .from("materials")
    .select("*")
    .eq("id", id)
    .eq("user_id", email)
    .maybeSingle();

  if (error || !material) {
    return NextResponse.json(
      { error: "Material not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ material });
});
