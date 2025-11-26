import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AnalysisView } from "@/components/features/analysis/AnalysisView";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function AnalysisPage({ params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/login");
    }

    const { data: material, error } = await supabase
        .from("materials")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", session.user.email)
        .single();

    if (error || !material) {
        redirect("/dashboard");
    }

    return <AnalysisView material={material} />;
}
