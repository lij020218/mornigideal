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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {materials.map((material) => (
                <Link key={material.id} href={`/analysis/${material.id}`}>
                    <div
                        className="group relative h-full min-h-[180px] p-5 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 hover:from-white/10 hover:to-white/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 overflow-hidden flex flex-col justify-between"
                    >
                        {/* Decorative Gradient Blob */}
                        <div className={`absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 ${material.type === 'exam' ? 'bg-blue-500' : 'bg-purple-500'
                            }`} />

                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${material.type === 'exam'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                    }`}>
                                    {material.type === 'exam' ? 'Exam Prep' : 'Work Doc'}
                                </div>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                    {new Date(material.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            <h4 className="text-lg font-bold mb-2 line-clamp-2 group-hover:text-white transition-colors leading-snug">
                                {material.title}
                            </h4>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                            <span className="text-xs text-muted-foreground flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${material.type === 'exam' ? 'bg-blue-500' : 'bg-purple-500'
                                    }`} />
                                {(() => {
                                    // Count slides from content (new format) or page_analyses (legacy)
                                    const slideCount = material.analysis?.content
                                        ? (material.analysis.content.match(/^## /gm) || []).length
                                        : (material.analysis?.page_analyses?.length || 0);
                                    return slideCount > 0 ? `${slideCount} 슬라이드` : '분석 대기 중';
                                })()}
                            </span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${material.type === 'exam'
                                    ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white'
                                    : 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white'
                                }`}>
                                <ArrowRight className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
