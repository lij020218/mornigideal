"use client";

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

// Set worker path - use unpkg CDN which is more reliable
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    fileUrl: string;
    onPageChange?: (page: number) => void;
    initialPage?: number;
    renderControls?: (controls: {
        pageNumber: number;
        numPages: number;
        scale: number;
        zoomIn: () => void;
        zoomOut: () => void;
    }) => React.ReactNode;
}

export function PDFViewer({ fileUrl, onPageChange, initialPage, renderControls }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Sync page number when initialPage changes
    useEffect(() => {
        if (initialPage && initialPage > 0) {
            setPageNumber(initialPage);
        }
    }, [initialPage]);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        // If initialPage is provided, use it, otherwise default to 1
        const startPage = initialPage && initialPage > 0 && initialPage <= numPages ? initialPage : 1;
        setPageNumber(startPage);
        setLoading(false);
        setError(null);
        onPageChange?.(startPage);
    }

    function onDocumentLoadError(error: Error) {
        console.error("PDF load error:", error);
        setError(error.message);
        setLoading(false);
    }

    function changePage(offset: number) {
        setPageNumber((prevPageNumber) => {
            const newPage = prevPageNumber + offset;
            onPageChange?.(newPage);
            return newPage;
        });
    }

    function previousPage() {
        changePage(-1);
    }

    function nextPage() {
        changePage(1);
    }

    function zoomIn() {
        setScale((prev) => Math.min(prev + 0.2, 2.0));
    }

    function zoomOut() {
        setScale((prev) => Math.max(prev - 0.2, 0.5));
    }

    return (
        <div className="flex flex-col h-full">
            {/* Custom Controls (rendered by parent) */}
            {renderControls && renderControls({ pageNumber, numPages, scale, zoomIn, zoomOut })}

            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-border">
                <Button
                    onClick={previousPage}
                    disabled={pageNumber <= 1}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                >
                    <ChevronLeft className="w-4 h-4" />
                    이전
                </Button>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                        {pageNumber} / {numPages}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            onClick={zoomOut}
                            disabled={scale <= 0.5}
                            variant="outline"
                            size="sm"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </Button>
                        <Button
                            onClick={zoomIn}
                            disabled={scale >= 2.0}
                            variant="outline"
                            size="sm"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <Button
                    onClick={nextPage}
                    disabled={pageNumber >= numPages}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                >
                    다음
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {/* PDF Display */}
            <div className="flex-1 overflow-auto bg-black/20 p-4 custom-scrollbar">
                <div className="flex items-start justify-center min-h-full">
                    {error ? (
                        <div className="text-center text-destructive bg-destructive/10 p-6 rounded-xl border border-destructive/20">
                            <p className="font-semibold">PDF 로드 실패</p>
                            <p className="text-sm mt-2 opacity-80">{error}</p>
                        </div>
                    ) : (
                        <Document
                            file={fileUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={
                                <div className="flex flex-col items-center gap-4 py-20">
                                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm text-muted-foreground animate-pulse">PDF 문서를 불러오는 중...</p>
                                </div>
                            }
                            className="shadow-2xl"
                        >
                            <Page
                                pageNumber={pageNumber}
                                scale={scale}
                                renderTextLayer={true}
                                renderAnnotationLayer={false}
                                loading={
                                    <div className="w-[600px] h-[800px] bg-white/5 animate-pulse rounded-lg flex items-center justify-center">
                                        <p className="text-sm text-muted-foreground">페이지 로딩 중...</p>
                                    </div>
                                }
                                className="shadow-2xl rounded-lg overflow-hidden bg-white"
                            />
                        </Document>
                    )}
                </div>
            </div>
        </div>
    );
}
