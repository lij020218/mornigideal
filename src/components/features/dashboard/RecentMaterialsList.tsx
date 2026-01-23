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
                    <div key={i} className="h-32 rounded-xl glass-card animate-pulse" />
                ))}
            </div>
        );
    }

    if (materials.length === 0) {
        return (
            <div className="p-6 rounded-xl glass-card border border-dashed border-border flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                    <p className="text-sm font-medium text-foreground">분석된 자료가 없습니다</p>
                    <p className="text-xs text-muted-foreground mt-1">새로운 자료를 업로드해보세요</p>
                </div>
                <Link href="/materials">
                    <Button size="sm" className="mt-2 h-8 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30">
                        자료 업로드
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {materials.map((material) => (
                <Link key={material.id} href={`/analysis/${material.id}`}>
                    <div
                        className="group relative h-full min-h-[140px] sm:min-h-[160px] md:min-h-[180px] p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl glass-card glass-card-hover overflow-hidden flex flex-col justify-between"
                    >
                        {/* Decorative Gradient Blob */}
                        <div className={`absolute top-0 right-0 -mt-8 -mr-8 w-24 sm:w-32 h-24 sm:h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 ${material.type === 'exam' ? 'bg-gradient-to-br from-amber-400 to-yellow-300' : 'bg-gradient-to-br from-orange-400 to-red-300'
                            }`} />

                        <div>
                            <div className="flex justify-between items-start mb-2 sm:mb-3 md:mb-4">
                                <div className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wide uppercase border shadow-sm ${material.type === 'exam'
                                    ? 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border-amber-300'
                                    : 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-700 border-orange-300'
                                    }`}>
                                    {material.type === 'exam' ? 'Exam Prep' : 'Work Doc'}
                                </div>
                                <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                                    {new Date(material.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            <h4 className="text-base sm:text-lg font-bold mb-2 line-clamp-2 text-foreground group-hover:text-gradient transition-colors leading-snug">
                                {material.title}
                            </h4>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 sm:mt-3 sm:pt-3 md:mt-4 md:pt-4 border-t border-border">
                            <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${material.type === 'exam' ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-orange-500 to-red-400'
                                    }`} />
                                {(() => {
                                    // Count slides from content (new format) or page_analyses (legacy)
                                    const slideCount = material.analysis?.content
                                        ? (material.analysis.content.match(/^## /gm) || []).length
                                        : (material.analysis?.page_analyses?.length || 0);
                                    return slideCount > 0 ? `${slideCount} 슬라이드` : '분석 대기 중';
                                })()}
                            </span>
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all shadow-md sm:shadow-lg ${material.type === 'exam'
                                    ? 'bg-gradient-to-br from-amber-500 to-yellow-400 text-white shadow-amber-500/25 md:from-amber-100 md:to-yellow-100 md:text-amber-700 md:shadow-none group-hover:md:from-amber-500 group-hover:md:to-yellow-400 group-hover:md:text-white group-hover:md:shadow-amber-500/35'
                                    : 'bg-gradient-to-br from-orange-500 to-red-400 text-white shadow-orange-500/25 md:from-orange-100 md:to-red-100 md:text-orange-700 md:shadow-none group-hover:md:from-orange-500 group-hover:md:to-red-400 group-hover:md:text-white group-hover:md:shadow-orange-500/35'
                                }`}>
                                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                            </div>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
