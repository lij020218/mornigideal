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
        redirect("/materials");
    }

    console.log("Material loaded:", {
        id: material.id,
        title: material.title,
        has_file_url: !!material.file_url,
        file_url: material.file_url,
        type: material.type
    });

    return (
        <div className="min-h-screen bg-gradient-mesh text-foreground relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

            {/* Header */}
            <div className="sticky top-0 z-50 border-b border-white/5 bg-background/5 backdrop-blur-xl">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/materials">
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold text-gradient">자료 분석 결과</h1>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{material.title}</span>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span>
                                    {new Date(material.created_at).toLocaleDateString("ko-KR", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions (Placeholder for future) */}
                    <div className="flex items-center gap-2">
                        {/* Add export or share buttons here if needed */}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 py-6 h-[calc(100vh-64px)]">
                <AnalysisView material={material} />
            </div>
        </div>
    );
}
