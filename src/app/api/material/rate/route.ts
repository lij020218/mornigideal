import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/material/rate
 *
 * Rate the quality of a material analysis
 * Body: { materialId: string, rating: "poor" | "good" }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { materialId, rating } = await request.json();

    if (!materialId || !rating) {
      return NextResponse.json(
        { error: "materialId and rating are required" },
        { status: 400 }
      );
    }

    if (rating !== "poor" && rating !== "good") {
      return NextResponse.json(
        { error: "rating must be 'poor' or 'good'" },
        { status: 400 }
      );
    }

    // Verify the material belongs to the user
    const { data: material, error: fetchError } = await supabase
      .from("materials")
      .select("id, user_id")
      .eq("id", materialId)
      .single();

    if (fetchError || !material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    if (material.user_id !== session.user.email) {
      return NextResponse.json(
        { error: "Unauthorized to rate this material" },
        { status: 403 }
      );
    }

    // Update the quality rating
    const { error: updateError } = await supabase
      .from("materials")
      .update({ quality_rating: rating })
      .eq("id", materialId);

    if (updateError) {
      console.error("[RATE] Error updating quality rating:", updateError);
      return NextResponse.json(
        { error: "Failed to update rating" },
        { status: 500 }
      );
    }

    console.log(`[RATE] User ${session.user.email} rated material ${materialId} as ${rating}`);

    return NextResponse.json({
      success: true,
      rating,
      materialId,
    });

  } catch (error) {
    console.error("[RATE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/material/rate?materialId=xxx
 *
 * Get the quality rating for a material
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get("materialId");

    if (!materialId) {
      return NextResponse.json(
        { error: "materialId is required" },
        { status: 400 }
      );
    }

    const { data: material, error } = await supabase
      .from("materials")
      .select("quality_rating")
      .eq("id", materialId)
      .eq("user_id", session.user.email)
      .single();

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

  } catch (error) {
    console.error("[RATE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
