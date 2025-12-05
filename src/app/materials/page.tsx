"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, BookOpen, Upload, Loader2, Clock, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { MaterialUploadDialog } from "@/components/features/dashboard/MaterialUploadDialog";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface Material {
  id: string;
  title: string;
  type: "exam" | "work";
  file_url?: string | null;
  created_at: string;
  analysis?: {
    page_analyses?: any[];
    content?: string;
  };
}

export default function MaterialsPage() {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Fetch materials from API (bypasses RLS issues)
  const fetchMaterials = async () => {
    try {
      setLoading(true);

      // Call API route instead of direct Supabase query
      const response = await fetch(`/api/materials?page=${currentPage}&limit=${ITEMS_PER_PAGE}`);

      if (response.ok) {
        const data = await response.json();
        console.log('[Materials] Fetched from API:', data.materials?.length || 0, 'materials');
        setMaterials(data.materials || []);
        setTotalPages(data.totalPages || 1);
      } else {
        console.error('[Materials] API error:', await response.text());
        setMaterials([]);
      }
    } catch (error) {
      console.error('[Materials] Error:', error);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [currentPage]);

  const handleOpenChange = (open: boolean) => {
    setShowUploadDialog(open);
    if (!open) {
      fetchMaterials(); // Refresh the list when dialog closes
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTypeInfo = (type: "exam" | "work") => {
    if (type === "exam") {
      return {
        icon: BookOpen,
        label: "시험 자료",
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      };
    }
    return {
      icon: FileText,
      label: "업무 자료",
      color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    };
  };

  return (
    <div className="min-h-screen bg-gradient-mesh text-foreground relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-white/5 bg-background/5 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gradient">자료 분석</h1>
              <p className="text-sm text-muted-foreground">
                AI가 분석한 학습 자료 보관함
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowUploadDialog(true)}
            className="gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md shadow-lg"
          >
            <Upload className="w-4 h-4" />
            새 자료 분석
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in">
        {/* Materials List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground animate-pulse">자료를 불러오는 중...</p>
          </div>
        ) : materials.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <FileText className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">분석된 자료가 없습니다</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                PDF, Word 등 학습 자료를 업로드하면<br />
                AI가 핵심 내용과 시험 포인트를 분석해드립니다.
              </p>
              <Button
                onClick={() => setShowUploadDialog(true)}
                size="lg"
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20"
              >
                <Upload className="w-5 h-5" />
                첫 자료 분석 시작하기
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {materials.map((material, index) => {
              const typeInfo = getTypeInfo(material.type);
              const TypeIcon = typeInfo.icon;
              // Check both page_analyses and content to determine status
              const hasAnalysis = (material.analysis?.page_analyses && material.analysis.page_analyses.length > 0) ||
                (material.analysis?.content && material.analysis.content.length > 100); // Simple check for content existence

              const slideCount = material.analysis?.page_analyses?.length ||
                (material.analysis?.content ? material.analysis.content.split('\n').filter((l: string) => l.match(/^\s*##\s+/)).length : 0);

              return (
                <Link key={material.id} href={`/analysis/${material.id}`}>
                  <div
                    className="glass-card rounded-2xl p-6 hover:bg-white/5 transition-all duration-300 cursor-pointer group relative overflow-hidden hover:-translate-y-1"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex items-start justify-between mb-4">
                      <Badge
                        variant="outline"
                        className={`gap-1.5 py-1.5 px-3 ${typeInfo.color} border-none bg-opacity-20`}
                      >
                        <TypeIcon className="w-3.5 h-3.5" />
                        {typeInfo.label}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-black/20 px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" />
                        {formatDate(material.created_at)}
                      </div>
                    </div>

                    <h3 className="text-lg font-bold mb-2 group-hover:text-gradient transition-all line-clamp-2 h-14">
                      {material.title}
                    </h3>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                        {hasAnalysis ? (slideCount > 0 ? `${slideCount}개 슬라이드` : '분석 완료') : '분석 대기 중'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-colors"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm("정말 이 자료를 삭제하시겠습니까?")) {
                              try {
                                const res = await fetch("/api/materials", {
                                  method: "DELETE",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: material.id }),
                                });
                                if (res.ok) {
                                  setMaterials(prev => prev.filter(m => m.id !== material.id));
                                } else {
                                  alert("삭제에 실패했습니다.");
                                }
                              } catch (err) {
                                console.error("Error deleting material:", err);
                                alert("삭제 중 오류가 발생했습니다.");
                              }
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300">
                          <ArrowLeft className="w-4 h-4 rotate-180" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && materials.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="border-white/10 hover:bg-white/10"
            >
              이전
            </Button>

            <div className="flex items-center gap-1 mx-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 p-0 ${currentPage !== page ? 'text-muted-foreground hover:text-white' : ''}`}
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="border-white/10 hover:bg-white/10"
            >
              다음
            </Button>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <MaterialUploadDialog
        open={showUploadDialog}
        onOpenChange={handleOpenChange}
      />
    </div>
  );
}
