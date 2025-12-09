"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, BookOpen, Upload, Loader2, Clock, ArrowLeft, Trash2, Folder, Plus, Edit2, MoreVertical, FolderOpen } from "lucide-react";
import Link from "next/link";
import { MaterialUploadDialog } from "@/components/features/dashboard/MaterialUploadDialog";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Material {
  id: string;
  title: string;
  type: "exam" | "work";
  file_url?: string | null;
  created_at: string;
  folder_id?: string | null;
  analysis?: {
    page_analyses?: any[];
    content?: string;
  };
}

interface FolderType {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export default function MaterialsPage() {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMaterials, setTotalMaterials] = useState(0);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 12;

  // Fetch folders from API
  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/folders');
      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('[Folders] Error:', error);
    }
  };

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
        setTotalMaterials(data.total || 0);
        setFolderCounts(data.folderCounts || {});
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

  // Create new folder
  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });

      if (response.ok) {
        setNewFolderName("");
        setShowNewFolderInput(false);
        fetchFolders();
      }
    } catch (error) {
      console.error('[Folders] Create error:', error);
    }
  };

  // Delete folder
  const deleteFolder = async (folderId: string) => {
    if (!confirm("이 폴더를 삭제하시겠습니까? (폴더 안의 자료는 삭제되지 않습니다)")) return;

    try {
      const response = await fetch('/api/folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folderId }),
      });

      if (response.ok) {
        if (selectedFolder === folderId) {
          setSelectedFolder(null);
        }
        fetchFolders();
        fetchMaterials();
      }
    } catch (error) {
      console.error('[Folders] Delete error:', error);
    }
  };

  // Move material to folder
  const moveMaterialToFolder = async (materialId: string, folderId: string | null) => {
    try {
      const response = await fetch('/api/materials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: materialId, folder_id: folderId }),
      });

      if (response.ok) {
        fetchMaterials();
      }
    } catch (error) {
      console.error('[Materials] Move error:', error);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [currentPage]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId) setOpenMenuId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const handleOpenChange = (open: boolean, shouldRefresh?: boolean) => {
    setShowUploadDialog(open);
    if (!open && shouldRefresh) {
      fetchMaterials(); // Refresh the list only if upload was completed
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

  // Filter materials by selected folder
  const filteredMaterials = selectedFolder === null
    ? materials
    : materials.filter(m => m.folder_id === selectedFolder);

  return (
    <div className="min-h-screen bg-gradient-mesh text-foreground relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full hover:bg-white/10">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-bold text-gradient">자료 분석</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                AI가 분석한 학습 자료 보관함
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowUploadDialog(true)}
            className="gap-2 h-9 px-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">새 자료 분석</span>
            <span className="sm:hidden">업로드</span>
          </Button>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="max-w-[1400px] mx-auto p-6 animate-fade-in">
        <div className="flex gap-6">
          {/* Sidebar - Folders */}
          <div className="w-56 shrink-0">
            <div className="glass-card rounded-2xl p-3 sticky top-24 space-y-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground">폴더</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-white/10"
                  onClick={() => setShowNewFolderInput(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* All Materials */}
              <button
                onClick={() => setSelectedFolder(null)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors",
                  selectedFolder === null
                    ? "bg-primary/20 text-primary"
                    : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                )}
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left truncate">모든 자료</span>
                <Badge variant="secondary" className="bg-white/10 text-xs shrink-0">
                  {totalMaterials}
                </Badge>
              </button>

              {/* New Folder Input */}
              {showNewFolderInput && (
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <input
                    type="text"
                    placeholder="폴더 이름"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createFolder();
                      if (e.key === 'Escape') {
                        setShowNewFolderInput(false);
                        setNewFolderName("");
                      }
                    }}
                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={createFolder}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* Folder List */}
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className={cn(
                    "group flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                    selectedFolder === folder.id
                      ? "bg-primary/20 text-primary"
                      : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div onClick={() => setSelectedFolder(folder.id)} className="flex items-center gap-2 flex-1 min-w-0">
                    <Folder className="w-4 h-4 shrink-0" style={{ color: folder.color }} />
                    <span className="flex-1 truncate">{folder.name}</span>
                    <Badge variant="secondary" className="bg-white/10 text-xs shrink-0">
                      {folderCounts[folder.id] || 0}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => deleteFolder(folder.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content - Materials Grid */}
          <div className="flex-1 space-y-8">
            {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground animate-pulse">자료를 불러오는 중...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMaterials.map((material, index) => {
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
                    className="glass-card rounded-xl p-4 hover:bg-white/5 transition-all duration-300 cursor-pointer group relative overflow-hidden hover:-translate-y-1"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Badge
                        variant="outline"
                        className={`gap-1 py-1 px-2 text-xs ${typeInfo.color} border-none bg-opacity-20 shrink-0`}
                      >
                        <TypeIcon className="w-3 h-3" />
                        {typeInfo.label}
                      </Badge>
                      <div className="relative ml-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === material.id ? null : material.id);
                          }}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                        {openMenuId === material.id && (
                          <div
                            className="absolute right-0 top-9 z-50 w-48 glass-card rounded-xl p-2 shadow-xl border border-white/10"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <div className="text-xs font-semibold text-muted-foreground px-2.5 py-1.5 mb-1">폴더로 이동</div>
                            {material.folder_id && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  moveMaterialToFolder(material.id, null);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-sm text-left transition-colors"
                              >
                                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                                <span>폴더 없음</span>
                              </button>
                            )}
                            {folders.map((folder) => (
                              folder.id !== material.folder_id && (
                                <button
                                  key={folder.id}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    moveMaterialToFolder(material.id, folder.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-sm text-left transition-colors"
                                >
                                  <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: folder.color }} />
                                  <span className="truncate">{folder.name}</span>
                                </button>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <h3 className="text-base font-bold mb-2 group-hover:text-gradient transition-all line-clamp-2 min-h-[2.5rem]">
                      {material.title}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-black/20 px-2.5 py-1 rounded-full w-fit mb-3">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{formatDate(material.created_at)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                        {hasAnalysis ? (slideCount > 0 ? `${slideCount}개` : '완료') : '대기중'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-colors"
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
                                  // 현재 페이지에서 삭제 후 남은 아이템 수 계산
                                  const remainingItems = materials.length - 1;

                                  // 현재 페이지가 비게 되고, 첫 페이지가 아니라면 이전 페이지로 이동
                                  if (remainingItems === 0 && currentPage > 1) {
                                    setCurrentPage(currentPage - 1);
                                  } else {
                                    // 같은 페이지에서 리프레시
                                    fetchMaterials();
                                  }
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
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300">
                          <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
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
        {!loading && filteredMaterials.length > 0 && totalPages > 1 && (
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
        </div>
      </div>

      {/* Upload Dialog */}
      <MaterialUploadDialog
        open={showUploadDialog}
        onOpenChange={handleOpenChange}
      />
    </div>
  );
}
