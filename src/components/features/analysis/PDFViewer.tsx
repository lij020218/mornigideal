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
}

export function PDFViewer({ fileUrl, onPageChange }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setPageNumber(1);
        setLoading(false);
        setError(null);
        onPageChange?.(1);
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
            {/* Controls */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    <Button
                        onClick={previousPage}
                        disabled={pageNumber <= 1}
                        size="sm"
                        variant="outline"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium">
                        {pageNumber} / {numPages}
                    </span>
                    <Button
                        onClick={nextPage}
                        disabled={pageNumber >= numPages}
                        size="sm"
                        variant="outline"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={zoomOut} size="sm" variant="outline">
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
                    <Button onClick={zoomIn} size="sm" variant="outline">
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* PDF Display */}
            <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/10 p-4">
                {error ? (
                    <div className="text-center text-destructive">
                        <p className="font-semibold">PDF 로드 실패</p>
                        <p className="text-sm mt-2">{error}</p>
                        <p className="text-xs mt-2 text-muted-foreground">URL: {fileUrl}</p>
                    </div>
                ) : (
                    <Document
                        file={fileUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={
                            <div className="text-center text-muted-foreground">
                                <p>PDF 로딩 중...</p>
                            </div>
                        }
                        className="max-w-full"
                    >
                        <Page
                            pageNumber={pageNumber}
                            scale={scale}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            loading={
                                <div className="text-center text-muted-foreground">
                                    <p>페이지 로딩 중...</p>
                                </div>
                            }
                            className="shadow-lg"
                        />
                    </Document>
                )}
            </div>
        </div>
    );
}
