import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserEmailWithAuth } from "@/lib/auth-utils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmailWithAuth(request);
    if (!userEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("slack_tokens")
      .select("slack_team_name, slack_user_id")
      .eq("user_email", userEmail)
      .single();

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
