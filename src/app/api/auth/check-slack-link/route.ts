import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from "@/lib/api-handler";

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const { data, error } = await supabaseAdmin
      .from("slack_tokens")
      .select("slack_team_name, slack_user_id")
      .eq("user_email", email)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ linked: false });
    }

    return NextResponse.json({
      linked: true,
      teamName: data.slack_team_name,
      slackUserId: data.slack_user_id,
    });
});
