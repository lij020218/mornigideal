"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, BookOpen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { PDFViewer } from "./PDFViewer";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface PageAnalysis {
    page: number;
    title: string;
    content: string; // 자연스럽게 통합된 전체 내용
    keyPoints?: string[]; // 시험 포인트 (exam) 또는 핵심 인사이트 (work)
}

interface Material {
    id: string;
    title: string;
    content: string;
    type: "exam" | "work";
    file_url?: string | null;
    analysis: {
        page_analyses?: PageAnalysis[];
    };
    created_at: string;
}

interface AnalysisViewProps {
    material: Material;
    onPageChange?: (page: number) => void;
}

export function AnalysisView({ material, onPageChange }: AnalysisViewProps) {
    // Separate navigation for PDF and summary slides
    const [summarySlide, setSummarySlide] = useState(1);

    // Get all page analyses for summary slides
    const pageAnalyses = material.analysis?.page_analyses || [];
    const totalSlides = pageAnalyses.length;
    const currentAnalysis = pageAnalyses[summarySlide - 1] || null;

    const nextSlide = () => {
        if (summarySlide < totalSlides) {
            setSummarySlide(summarySlide + 1);
        }
    };

    const previousSlide = () => {
        if (summarySlide > 1) {
            setSummarySlide(summarySlide - 1);
        }
    };

    // Debug logging
    console.log("AnalysisView render:", {
        has_file_url: !!material.file_url,
        file_url: material.file_url,
        title: material.title,
        summarySlide,
        totalSlides
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full animate-fade-in">
            {/* Left: Original PDF - Single Big Scrollable Card */}
            <div className="glass-card rounded-2xl h-full overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <FileText className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-semibold text-sm">원본 자료</span>
                        </div>
                        <Badge variant={material.type === "exam" ? "default" : "secondary"} className="bg-white/10 hover:bg-white/20 text-white border-none">
                            {material.type === "exam" ? "시험 자료" : "업무 자료"}
                        </Badge>
                    </div>

                    {/* PDF Controls */}
                    {material.file_url && (
                        <div id="pdf-controls-container" />
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {material.file_url ? (
                        <PDFViewer
                            fileUrl={material.file_url}
                            onPageChange={() => { }}
                            renderControls={({ pageNumber, numPages, scale, zoomIn, zoomOut }) => (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-xs font-medium text-gray-300 tabular-nums">
                                        페이지 {pageNumber} / {numPages}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={zoomOut}
                                            size="icon"
                                            variant="ghost"
                                            className="w-7 h-7 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                            disabled={scale <= 0.5}
                                        >
                                            <ZoomOut className="w-3.5 h-3.5" />
                                        </Button>
                                        <span className="text-xs font-medium text-gray-300 w-12 text-center tabular-nums">
                                            {Math.round(scale * 100)}%
                                        </span>
                                        <Button
                                            onClick={zoomIn}
                                            size="icon"
                                            variant="ghost"
                                            className="w-7 h-7 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                            disabled={scale >= 2.0}
                                        >
                                            <ZoomIn className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        />
                    ) : (
                        <div className="p-6">
                            <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                                {material.content}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Summary - Single Big Scrollable Card */}
            <div className="glass-card rounded-2xl h-full overflow-hidden flex flex-col">
                {/* Header with Navigation */}
                <div className="p-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <BookOpen className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">AI 요약본</h3>
                                <p className="text-[10px] text-muted-foreground">핵심 내용 분석 완료</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 bg-black/20 rounded-full p-1">
                            <Button
                                onClick={previousSlide}
                                disabled={summarySlide <= 1}
                                size="icon"
                                variant="ghost"
                                className="w-8 h-8 rounded-full hover:bg-white/10"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-xs font-medium w-12 text-center tabular-nums">
                                {summarySlide} / {totalSlides}
                            </span>
                            <Button
                                onClick={nextSlide}
                                disabled={summarySlide >= totalSlides}
                                size="icon"
                                variant="ghost"
                                className="w-8 h-8 rounded-full hover:bg-white/10"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {currentAnalysis ? (
                        <div className="space-y-6 animate-slide-up" key={summarySlide}>
                            {/* Main Content Section */}
                            <div className="relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                                <div className="pl-6">
                                    <h3 className="text-xl font-bold mb-4 text-gradient">{currentAnalysis.title}</h3>
                                <div className="text-sm leading-[1.8] text-gray-300 markdown-content space-y-1">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            // **단어 강조** -> 퍼플 하이라이트
                                            strong: ({ node, ...props }: any) => (
                                                <span className="bg-purple-500/20 text-purple-200 px-1 rounded font-semibold" {...props} />
                                            ),
                                            // *문장 강조* -> 파란색 강조
                                            em: ({ node, ...props }: any) => (
                                                <span className="bg-blue-500/20 text-blue-200 px-1 rounded font-medium not-italic" {...props} />
                                            ),
                                            // > 인용구 -> 시안 블루 유리 글래스 카드 (개념/수식용)
                                            blockquote: ({ node, ...props }: any) => (
                                                <div className="my-6 p-6 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-cyan-600/15 border border-cyan-400/30 backdrop-blur-md shadow-[0_8px_32px_rgba(6,182,212,0.25)] relative overflow-hidden" {...props}>
                                                    {/* Glass effect overlay */}
                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                                                    {/* Glow effect */}
                                                    <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-xl opacity-50 pointer-events-none" />
                                                    {/* Content */}
                                                    <div className="relative text-cyan-50 font-medium leading-[1.8]">{props.children}</div>
                                                </div>
                                            ),
                                            // 문단
                                            p: ({ node, ...props }: any) => (
                                                <p className="mb-5 last:mb-0 leading-[1.8]" {...props} />
                                            ),
                                            // 리스트
                                            ul: ({ node, ...props }: any) => (
                                                <ul className="list-disc list-inside space-y-3 mb-6 ml-2" {...props} />
                                            ),
                                            ol: ({ node, ...props }: any) => (
                                                <ol className="list-decimal list-inside space-y-3 mb-6 ml-2" {...props} />
                                            ),
                                            li: ({ node, ...props }: any) => (
                                                <li className="text-gray-300 leading-[1.8] pl-2" {...props} />
                                            ),
                                            // 코드 블록 -> 중요 개념 카드
                                            code: ({ node, inline, ...props }: any) => {
                                                if (inline) {
                                                    // 인라인 코드 -> 주황색 강조
                                                    return (
                                                        <code className="bg-orange-500/20 text-orange-200 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                                                    );
                                                } else {
                                                    // 블록 코드 -> 중요 개념 카드
                                                    return (
                                                        <div className="my-6 p-6 rounded-xl bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/20 backdrop-blur-sm shadow-lg">
                                                            <div className="flex items-start gap-3">
                                                                <div className="mt-1 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                                                <code className="text-green-100 font-medium leading-[1.8] block" {...props} />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            },
                                            // 제목 3 -> 섹션 구분
                                            h3: ({ node, ...props }: any) => (
                                                <h3 className="text-base font-bold mt-8 mb-4 text-white flex items-center gap-2" {...props}>
                                                    <span className="w-1 h-4 bg-gradient-to-b from-blue-400 to-purple-400 rounded-full" />
                                                    {props.children}
                                                </h3>
                                            ),
                                            // 제목 4 -> 소제목
                                            h4: ({ node, ...props }: any) => (
                                                <h4 className="text-sm font-semibold mt-6 mb-3 text-gray-200" {...props} />
                                            ),
                                        }}
                                    >
                                        {currentAnalysis.content}
                                    </ReactMarkdown>
                                </div>
                                </div>
                            </div>

                            {/* Key Points Section */}
                            {currentAnalysis.keyPoints && currentAnalysis.keyPoints.length > 0 && (
                                <div className="pt-6 border-t border-white/10">
                                    <h4 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                        {material.type === "exam" ? (
                                            <>
                                                <BookOpen className="w-5 h-5 text-blue-400" />
                                                <span className="text-blue-100">시험 포인트</span>
                                            </>
                                        ) : (
                                            <>
                                                <FileText className="w-5 h-5 text-purple-400" />
                                                <span className="text-purple-100">핵심 인사이트</span>
                                            </>
                                        )}
                                    </h4>
                                    <ul className="space-y-3">
                                        {currentAnalysis.keyPoints.map((point, idx) => (
                                            <li key={idx} className="flex gap-3 group">
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary/30 transition-colors shrink-0 mt-0.5">
                                                    {idx + 1}
                                                </span>
                                                <span className="text-sm leading-relaxed text-gray-300 group-hover:text-white transition-colors">{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                <FileText className="w-8 h-8 opacity-20" />
                            </div>
                            <p>이 슬라이드에 대한 분석이 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
