import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

export function RecentMaterialsList() {
    const [materials, setMaterials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecentMaterials = async () => {
            try {
                const response = await fetch('/api/materials');
                if (response.ok) {
                    const data = await response.json();
                    setMaterials((data.materials || []).slice(0, 3));
                }
            } catch (error) {
                console.error("Error fetching recent materials:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecentMaterials();
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 rounded-xl bg-white/5 animate-pulse" />
                ))}
            </div>
        );
    }

    if (materials.length === 0) {
        return (
            <div className="p-6 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 text-center bg-white/5">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground">분석된 자료가 없습니다</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">새로운 자료를 업로드해보세요</p>
                </div>
                <Link href="/materials">
                    <Button size="sm" variant="outline" className="mt-2 h-8 text-xs bg-white/5 border-white/10 hover:bg-white/10">
                        자료 업로드
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {materials.map((material) => (
                <Link key={material.id} href={`/analysis/${material.id}`}>
                    <div
                        className="group relative h-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex justify-between items-start mb-3">
                            <div className={`px-2 py-1 rounded-md text-[10px] font-medium border ${material.type === 'exam'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                }`}>
                                {material.type === 'exam' ? '시험' : '업무'}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                                {new Date(material.created_at).toLocaleDateString()}
                            </span>
                        </div>

                        <h4 className="text-sm font-semibold mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
                            {material.title}
                        </h4>

                        <div className="flex items-center justify-between mt-auto pt-2">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-blue-500" />
                                {material.analysis?.page_analyses?.length || 0} 슬라이드
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-white group-hover:translate-x-1 transition-all" />
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
