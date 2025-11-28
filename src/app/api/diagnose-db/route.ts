import { NextResponse } from "next/server";
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

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    checks: {},
    summary: "OK",
  };

  try {
    // 1. Check materials table exists
    console.log("[DIAGNOSE] Checking materials table...");
    const { data: materialsData, error: materialsError } = await supabase
      .from("materials")
      .select("id")
      .limit(1);

    diagnostics.checks.materials_table = {
      exists: !materialsError,
      error: materialsError?.message || null,
      sample_count: materialsData?.length || 0,
    };

    if (materialsError) {
      diagnostics.summary = "ERROR";
      console.error("[DIAGNOSE] Materials table error:", materialsError);
    }

    // 2. Check storage bucket exists
    console.log("[DIAGNOSE] Checking materials storage bucket...");
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    const materialsBucket = buckets?.find((b) => b.name === "materials");
    diagnostics.checks.storage_bucket = {
      exists: !!materialsBucket,
      bucket_info: materialsBucket || null,
      error: bucketsError?.message || null,
    };

    if (bucketsError || !materialsBucket) {
      diagnostics.summary = "WARNING";
      console.error("[DIAGNOSE] Storage bucket error:", bucketsError);
    }

    // 3. Try to fetch actual materials
    console.log("[DIAGNOSE] Fetching materials list...");
    const { data: allMaterials, error: fetchError } = await supabase
      .from("materials")
      .select("id, title, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(5);

    diagnostics.checks.materials_data = {
      count: allMaterials?.length || 0,
      recent_materials: allMaterials || [],
      error: fetchError?.message || null,
    };

    // 4. Environment variables check
    diagnostics.checks.env_vars = {
      has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_openai_key: !!process.env.OPENAI_API_KEY,
    };

    console.log("[DIAGNOSE] Diagnostics complete:", diagnostics);

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    console.error("[DIAGNOSE] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Diagnostics failed",
        details: error.message,
        summary: "FATAL_ERROR",
      },
      { status: 500 }
    );
  }
}
