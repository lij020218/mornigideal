import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnalysisView } from "@/components/features/analysis/AnalysisView";

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

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function AnalysisPage({ params }: PageProps) {
    const { id } = await params;

    const { data: material, error } = await supabase
        .from("materials")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !material) {
        console.error("Failed to load material:", error);
        redirect("/dashboard");
    }

    console.log("Material loaded:", {
        id: material.id,
        title: material.title,
        has_file_url: !!material.file_url,
        file_url: material.file_url,
        type: material.type
    });

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold">자료 분석 결과</h1>
                            <p className="text-sm text-muted-foreground">
                                {new Date(material.created_at).toLocaleDateString("ko-KR", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 py-6">
                <AnalysisView material={material} />
            </div>
        </div>
    );
}
