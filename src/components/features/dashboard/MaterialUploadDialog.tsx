"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Loader2, BookOpen, Sparkles, Check } from "lucide-react";
import { upload } from "@vercel/blob/client";

interface MaterialUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean, shouldRefresh?: boolean) => void;
}

export function MaterialUploadDialog({ open, onOpenChange }: MaterialUploadDialogProps) {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [type, setType] = useState<"exam" | "work">("exam");
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<{ stage: string; message: string; pagesGenerated?: number }>({ stage: "", message: "" });
    const [materialId, setMaterialId] = useState<string | null>(null);
    const [uploadCompleted, setUploadCompleted] = useState(false);

    const handleClose = () => {
        // Reset state when closing
        setFile(null);
        setUploading(false);
        setProgress({ stage: "", message: "" });
        setMaterialId(null);

        // Only refresh if upload was completed
        const shouldRefresh = uploadCompleted;
        setUploadCompleted(false);

        onOpenChange(false, shouldRefresh);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const validTypes = [
                "text/plain",
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ];

            // Check file size (50MB limit with Blob Storage)
            const maxSize = 50 * 1024 * 1024; // 50MB in bytes
            if (selectedFile.size > maxSize) {
                alert("파일 크기가 너무 큽니다. 50MB 이하의 파일만 업로드 가능합니다.");
                e.target.value = ""; // Reset input
                return;
            }

            if (validTypes.includes(selectedFile.type)) {
                setFile(selectedFile);
            } else {
                alert("지원하지 않는 파일 형식입니다. TXT, PDF, DOC, DOCX 파일만 업로드 가능합니다.");
            }
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            alert("파일을 선택해주세요.");
            return;
        }

        setUploading(true);
        setProgress({ stage: "starting", message: "파일 업로드 중..." });

        try {
            // Step 1: Upload file directly to Blob Storage from client
            setProgress({ stage: "uploading", message: "파일 업로드 중..." });

            // Generate unique filename to avoid conflicts
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(7);
            const uniqueFilename = `${timestamp}-${randomSuffix}-${file.name}`;

            const blob = await upload(uniqueFilename, file, {
                access: 'public',
                handleUploadUrl: '/api/upload-blob',
            });

            const blobUrl = blob.url;

            // Step 2: Start analysis with blob URL
            setProgress({ stage: "starting", message: "분석 시작 중..." });

            const analysisResponse = await fetch("/api/analyze-material-stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    blobUrl,
                    fileName: file.name,
                    type,
                }),
            });

            if (!analysisResponse.ok) {
                throw new Error("분석 시작 실패");
            }

            const reader = analysisResponse.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error("스트림을 읽을 수 없습니다");
            }

            let buffer = "";
            let currentMaterialId: string | null = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete events from buffer
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || ""; // Keep incomplete event in buffer

                for (const line of lines) {
                    if (!line.trim()) continue;

                    const eventMatch = line.match(/^event: (.+)\ndata: (.+)$/);
                    if (!eventMatch) continue;

                    const [, eventType, dataStr] = eventMatch;
                    const data = JSON.parse(dataStr);

                    console.log(`[STREAM] ${eventType}:`, data);

                    switch (eventType) {
                        case "progress":
                            setProgress({
                                stage: data.stage,
                                message: data.message
                            });
                            break;

                        case "content":
                            // Content is streaming - navigate to analysis page if not already done
                            if (!currentMaterialId) {
                                // Wait briefly for materialId from complete event
                                break;
                            }
                            // Auto-navigate on first content chunk
                            if (currentMaterialId) {
                                console.log("[STREAM] Content streaming started, navigating to:", `/analysis/${currentMaterialId}`);
                                onOpenChange(false);
                                router.push(`/analysis/${currentMaterialId}`);
                                currentMaterialId = null; // Prevent repeated navigation
                            }
                            break;

                        case "complete":
                            console.log("[STREAM] Analysis complete");
                            currentMaterialId = data.materialId;
                            setMaterialId(data.materialId);
                            setUploadCompleted(true);

                            // Navigate to analysis page
                            if (data.materialId) {
                                onOpenChange(false);
                                router.push(`/analysis/${data.materialId}`);
                            }
                            break;

                        case "error":
                            throw new Error(data.error || "분석 실패");
                    }
                }
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            const errorMessage = error.message.includes('413') || error.message.includes('Content Too Large')
                ? '파일이 너무 큽니다. 50MB 이하의 파일만 업로드 가능합니다.'
                : `분석 실패: ${error.message}`;
            alert(errorMessage);
            setUploading(false);
            setProgress({ stage: "", message: "" });
        }
    };

    const getStageLabel = (stage: string) => {
        switch (stage) {
            case "upload": return "업로드";
            case "download_and_extract": return "파일 다운로드";
            case "image_analysis": return "이미지 분석";
            case "chunking": return "텍스트 분할";
            case "extract": return "텍스트 추출";
            case "analyze_chunks": return "내용 분석";
            case "clustering": return "그룹화";
            case "compress": return "압축";
            case "final_integration": return "최종 생성";
            case "generating_pages": return "슬라이드 생성";
            default: return "처리 중";
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) {
                handleClose();
            }
        }}>
            <DialogContent className="w-[90%] sm:w-full sm:max-w-md border-none bg-black/90 backdrop-blur-xl text-white shadow-2xl p-0 overflow-hidden [&>button]:z-50 rounded-2xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

                <DialogHeader className="p-6 pb-2 relative z-10">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-white/10">
                            <FileText className="w-5 h-5 text-blue-400" />
                        </span>
                        자료 분석
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        AI가 자료를 분석하여 핵심 내용과 인사이트를 도출합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 p-6 pt-2 relative z-10">
                    {uploading ? (
                        /* Progress View */
                        <div className="py-8 space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <Loader2 className="w-16 h-16 animate-spin text-primary" />
                                    <Sparkles className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-sm font-semibold text-white">{getStageLabel(progress.stage)}</p>
                                    <p className="text-xs text-gray-400">{progress.message}</p>
                                    {progress.pagesGenerated && (
                                        <p className="text-xs text-green-400">✓ {progress.pagesGenerated}개 슬라이드 생성 완료</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400">처리 단계</span>
                                    <span className="text-gray-400">{progress.stage ? getStageLabel(progress.stage) : "시작 중..."}</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" style={{ width: "60%" }} />
                                </div>
                            </div>

                            <p className="text-xs text-center text-muted-foreground">
                                첫 번째 슬라이드가 생성되는 대로 분석 화면으로 이동합니다
                            </p>
                        </div>
                    ) : (
                        /* Upload Form */
                        <>
                            {/* File Upload */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium text-gray-300">파일 선택</Label>
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="relative border border-white/10 bg-white/5 rounded-xl p-8 text-center hover:bg-white/10 transition-all duration-300 cursor-pointer group-hover:border-white/20">
                                        <input
                                            type="file"
                                            accept=".txt,.pdf,.doc,.docx"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="file-upload"
                                        />
                                        <label htmlFor="file-upload" className="cursor-pointer w-full h-full block">
                                            {file ? (
                                                <div className="flex flex-col items-center gap-3 animate-fade-in">
                                                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                                                        <FileText className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-white">{file.name}</p>
                                                        <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={(e) => {
                                                        e.preventDefault();
                                                        setFile(null);
                                                    }}>
                                                        삭제
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                        <Upload className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                                                            클릭하여 파일 업로드
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            PDF, TXT, DOC, DOCX (최대 50MB)
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Type Selection */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium text-gray-300">자료 유형</Label>
                                <RadioGroup value={type} onValueChange={(value) => setType(value as "exam" | "work")} className="grid grid-cols-2 gap-3">
                                    <div className={`relative border rounded-xl p-4 cursor-pointer transition-all duration-300 ${type === 'exam' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                        <RadioGroupItem value="exam" id="exam" className="sr-only" />
                                        <Label htmlFor="exam" className="cursor-pointer block">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BookOpen className={`w-4 h-4 ${type === 'exam' ? 'text-blue-400' : 'text-gray-400'}`} />
                                                <span className={`font-semibold ${type === 'exam' ? 'text-blue-100' : 'text-gray-300'}`}>시험 자료</span>
                                            </div>
                                            <p className="text-xs text-gray-400 leading-relaxed">
                                                시험 대비를 위한<br />핵심 포인트 추출
                                            </p>
                                        </Label>
                                    </div>
                                    <div className={`relative border rounded-xl p-4 cursor-pointer transition-all duration-300 ${type === 'work' ? 'bg-purple-500/10 border-purple-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                        <RadioGroupItem value="work" id="work" className="sr-only" />
                                        <Label htmlFor="work" className="cursor-pointer block">
                                            <div className="flex items-center gap-2 mb-2">
                                                <FileText className={`w-4 h-4 ${type === 'work' ? 'text-purple-400' : 'text-gray-400'}`} />
                                                <span className={`font-semibold ${type === 'work' ? 'text-purple-100' : 'text-gray-300'}`}>업무 자료</span>
                                            </div>
                                            <p className="text-xs text-gray-400 leading-relaxed">
                                                업무 효율을 위한<br />인사이트 도출
                                            </p>
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {/* Submit Button */}
                            <Button
                                onClick={handleSubmit}
                                disabled={!file}
                                className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Sparkles className="w-4 h-4 mr-2" />
                                AI 분석 시작
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
