"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { PDFViewer } from "./PDFViewer";

interface PageAnalysis {
    page: number;
    title: string;
    content: string; // 자연스럽게 통합된 전체 내용
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left: Original PDF */}
            <Card className="glass-card border-none h-full">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        <CardTitle>원본 자료</CardTitle>
                        <Badge variant={material.type === "exam" ? "default" : "secondary"}>
                            {material.type === "exam" ? "시험 자료" : "업무 자료"}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{material.title}</p>
                </CardHeader>
                <CardContent className="h-[calc(100%-120px)]">
                    {material.file_url ? (
                        <PDFViewer
                            fileUrl={material.file_url}
                            onPageChange={() => {}} // PDF 독립 네비게이션
                        />
                    ) : (
                        <div className="h-full overflow-auto">
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                {material.content}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Right: Summary Slides */}
            <div className="flex flex-col h-full">
                {/* Summary Navigation */}
                <div className="flex items-center justify-between p-4 border-b bg-muted/30 rounded-t-lg">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-500" />
                        <h3 className="font-semibold">AI 요약본</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={previousSlide}
                            disabled={summarySlide <= 1}
                            size="sm"
                            variant="outline"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm font-medium">
                            {summarySlide} / {totalSlides}
                        </span>
                        <Button
                            onClick={nextSlide}
                            disabled={summarySlide >= totalSlides}
                            size="sm"
                            variant="outline"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Summary Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {currentAnalysis ? (
                        <Card className="glass-card border-none">
                            <CardHeader>
                                <CardTitle className="text-xl">{currentAnalysis.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {currentAnalysis.content}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="glass-card border-none">
                            <CardContent className="p-6 text-center text-muted-foreground">
                                <p>이 슬라이드에 대한 분석이 없습니다.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
