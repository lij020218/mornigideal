import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserEmailWithAuth } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmailWithAuth(request);
    if (!userEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("slack_tokens")
      .select("slack_team_name, slack_user_id")
      .eq("user_email", userEmail)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ linked: false });
    }

    return NextResponse.json({
      linked: true,
      teamName: data.slack_team_name,
      slackUserId: data.slack_user_id,
    });
  } catch (error) {
    console.error("[Check Slack Link] Error:", error);
    return NextResponse.json({ error: "Failed to check Slack link" }, { status: 500 });
  }
}
