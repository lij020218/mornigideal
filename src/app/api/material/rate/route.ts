import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { materialRateSchema, validateBody } from '@/lib/schemas';
import { logger } from '@/lib/logger';

/**
 * POST /api/material/rate
 *
 * Rate the quality of a material analysis
 * Body: { materialId: string, rating: "poor" | "good" }
 */
export const POST = withAuth(async (request: NextRequest, email: string) => {
  const body = await request.json();
  const v = validateBody(materialRateSchema, body);
  if (!v.success) return v.response;
  const { materialId, rating } = v.data;

  // Verify the material belongs to the user
  const { data: material, error: fetchError } = await supabaseAdmin
    .from("materials")
    .select("id, user_id")
    .eq("id", materialId)
    .maybeSingle();

  if (fetchError || !material) {
    return NextResponse.json(
      { error: "Material not found" },
      { status: 404 }
    );
  }

  if (material.user_id !== email) {
    return NextResponse.json(
      { error: "Unauthorized to rate this material" },
      { status: 403 }
    );
  }

  // Update the quality rating
  const { error: updateError } = await supabaseAdmin
    .from("materials")
    .update({ quality_rating: rating })
    .eq("id", materialId);

  if (updateError) {
    logger.error("[RATE] Error updating quality rating:", updateError);
    return NextResponse.json(
      { error: "Failed to update rating" },
      { status: 500 }
    );
  }


  return NextResponse.json({
    success: true,
    rating,
    materialId,
  });
});

/**
 * GET /api/material/rate?materialId=xxx
 *
 * Get the quality rating for a material
 */
export const GET = withAuth(async (request: NextRequest, email: string) => {
  const { searchParams } = new URL(request.url);
  const materialId = searchParams.get("materialId");

  if (!materialId) {
    return NextResponse.json(
      { error: "materialId is required" },
      { status: 400 }
    );
  }

  const { data: material, error } = await supabaseAdmin
    .from("materials")
    .select("quality_rating")
    .eq("id", materialId)
    .eq("user_id", email)
    .maybeSingle();

  if (error || !material) {
    return NextResponse.json(
      { error: "Material not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    materialId,
    rating: material.quality_rating || null,
  });
});
